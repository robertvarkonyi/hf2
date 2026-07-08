# Ügyfél-távolság REST szolgáltatás — tervdokumentum

**Dátum:** 2026-07-08
**Állapot:** jóváhagyásra vár

## 1. Cél és hatókör

Kicsi, önálló REST szolgáltatás Postgres adatbázis fölött, amely a repóban lévő
`seed/seed-customers.json` ügyféladatokat betölti, minden ügyfél településéhez lokálisan
(offline) koordinátát rendel, és két végponton keresztül szolgáltat adatot: az ügyfelek
darabszámát, illetve az ügyfeleket a Budapesttől mért távolság szerint növekvő sorrendben.

**Offline követelmény:** futásidőben nincs külső geokódoló API-hívás és nincs LLM-hívás.
A település → koordináta megfeleltetés egy repóba bundle-olt, kézzel karbantartott
referenciából történik.

## 2. Technológiai stack

- **Nyelv/futtatókörnyezet:** Node.js + TypeScript
- **HTTP keretrendszer:** Fastify
- **Adatbázis:** PostgreSQL, Docker Compose-ban futtatva (verziórögzített, eldobható)
- **Séma és migráció:** Prisma — **kizárólag a modell definiálására és a migrációk
  generálására/futtatására.** Prisma **nem** végez lekérdezést.
- **Lekérdezések (futásidő):** `pg` driver, nyers, paraméterezett SQL. A `@prisma/client`
  futásidőben nincs importálva.
- **Tesztelés:** Vitest
- **Dokumentáció nyelve:** magyar (a kód és az azonosítók angolul maradnak; az adatmodell
  mezőneve a specifikáció szerint `telepules`)

Függőségek:
- futásidő: `fastify`, `pg`
- fejlesztői: `prisma`, `typescript`, `tsx`, `vitest`, `@types/pg`, `@types/node`

## 3. Adatmodell

`customers` tábla (Prisma `Customer` modell, `@@map("customers")`):

| oszlop     | típus            | megjegyzés                         |
|------------|------------------|------------------------------------|
| id         | serial, PK       | `@id @default(autoincrement())`    |
| name       | text             |                                    |
| telepules  | text             | a település (a seed `location.city`) |
| lat        | double, nullable | ismeretlen esetén `null`           |
| lon        | double, nullable | ismeretlen esetén `null`           |
| budget     | int, nullable    | eltárolva, de nem kötelező         |
| note       | text, nullable   | eltárolva, de nem kötelező         |

**Idempotencia-kulcs:** `@@unique([name, telepules])` — ebből Prisma egyedi indexet
készít, amelyre a seed `ON CONFLICT (name, telepules)` hivatkozik.

## 4. Geokódoló referencia (offline)

`src/geo/city-coordinates.json`: normalizált településnév → `{ lat, lon }`. A seedben
előforduló 15 város ismert koordinátái (városközpont, kerekített):

| kulcs (normalizált) | eredeti (seed) | lat      | lon      |
|---------------------|----------------|----------|----------|
| budapest            | Budapest       | 47.4979  | 19.0402  |
| vienna              | Vienna         | 48.2082  | 16.3738  |
| munich              | Munich         | 48.1351  | 11.5820  |
| milan               | Milan          | 45.4642  | 9.1900   |
| barcelona           | Barcelona      | 41.3874  | 2.1686   |
| lyon                | Lyon           | 45.7640  | 4.8357   |
| krakow              | Kraków         | 50.0647  | 19.9450  |
| prague              | Prague         | 50.0755  | 14.4378  |
| lisbon              | Lisbon         | 38.7223  | -9.1393  |
| amsterdam           | Amsterdam      | 52.3676  | 4.9041   |
| stockholm           | Stockholm      | 59.3293  | 18.0686  |
| ljubljana           | Ljubljana      | 46.0569  | 14.5058  |
| bucharest           | Bucharest      | 44.4268  | 26.1025  |
| dublin              | Dublin         | 53.3498  | -6.2603  |
| copenhagen          | Copenhagen     | 55.6761  | 12.5683  |

### Normalizálás (`src/geo/normalize.ts`)

`normalize(s)`: `s.trim()` → kisbetűsítés → ékezetek eltávolítása (Unicode NFD + a
combining diacritical mark tartomány törlése) → belső whitespace összevonása egyetlen
szóközzé. Így `"Kraków"`, `" kraków "`, `"KRAKOW"` mind a `krakow` kulcsra esik.

### Keresés (`src/geo/geocode.ts`)

`geocode(city)`:
1. normalizálja a bemenetet;
2. **Budapest-szabály:** ha a normalizált érték `budapest`-tel kezdődik (beleértve a
   kerületeket, pl. `Budapest XI.`), a főváros koordinátáit adja vissza;
3. egyébként a referenciából olvassa ki;
4. ha nincs találat → `{ lat: null, lon: null }` (ez **nem hiba**), és a hívó oldalon
   Fastify loggerrel naplózzuk.

## 5. Távolságszámítás (`src/geo/haversine.ts`)

Tiszta (mellékhatásmentes) modul, ez a távolságlogika **egyetlen forrása** — ugyanezt
használja a végpont és a unit teszt is.

- `haversineKm(a, b)`: haversine képlet, `R = 6371` km, két `{ lat, lon }` pont között.
- `BUDAPEST`: exportált referenciakoordináta (`{ lat: 47.4979, lon: 19.0402 }`).
- `distanceFromBudapestKm(point)`: ha `point.lat` vagy `point.lon` `null`/hiányzik →
  `null`; egyébként `haversineKm(BUDAPEST, point)`.

Kontroll: Budapest→Vienna ≈ 214,1 km ezekkel a koordinátákkal.

## 6. Betöltés / seed (`src/seed.ts`, `npm run seed`)

1. Beolvassa a `seed/seed-customers.json`-t.
2. Minden rekordhoz `geocode(location.city)` → `lat/lon` (vagy `null`, naplózva).
3. `pg` nyers SQL upsert:
   ```sql
   INSERT INTO customers (name, telepules, lat, lon, budget, note)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (name, telepules) DO UPDATE
     SET lat = EXCLUDED.lat, lon = EXCLUDED.lon,
         budget = EXCLUDED.budget, note = EXCLUDED.note;
   ```
4. Kétszer lefuttatva nem duplázódik (a darabszám 15 marad), és frissíti a
   lat/lon/budget/note értékeket.

## 7. Végpontok (`src/routes/customers.ts`)

### `GET /customers/count`
Válasz: `{ "count": <egész> }`, a `SELECT count(*)::int AS count FROM customers` alapján.

### `GET /customers/by-distance`
1. `SELECT id, name, telepules, lat, lon, budget, note FROM customers`.
2. Minden sorra `distanceFromBudapestKm(...)`, 1 tizedesre kerekítve (`distanceKm`).
3. Rendezés:
   - ismert koordinátájú ügyfelek **növekvő** `distanceKm` szerint (a budapestiek 0,0 km,
     elöl);
   - ismeretlen koordinátájú ügyfelek a lista **végén**, `distanceKm: null`;
   - holtverseny esetén `name` szerint (ábécé) növekvő.
4. Elem alakja: `{ id, name, telepules, lat, lon, budget, note, distanceKm }`.

A rendezés és a távolságszámítás az alkalmazásrétegben történik (mindössze 15 sor), így a
haversine-logika egyetlen, tesztelt forrásból származik — nincs külön SQL-beli haversine.

## 8. Tesztek (`test/haversine.test.ts`, Vitest)

- **Ismert távolság:** Budapest→Vienna ≈ 214 km (tolerancia ±5 km).
- **0 km eset:** Budapest→Budapest = 0 km.
- **Null-koordináta kezelés:** `distanceFromBudapestKm` `null`-t ad, ha bármelyik
  koordináta hiányzik.

## 9. Postgres MCP bekötése (`.mcp.json`)

Read-only referencia MCP szerver (`npx -y @modelcontextprotocol/server-postgres`) a Docker
Postgres-re irányítva, hogy fejlesztés közben a séma és az adat közvetlenül vizsgálható
legyen. A felhasználó a következő munkamenet indulásakor engedélyezi.

## 10. Projektstruktúra

```
docker-compose.yml
package.json
tsconfig.json
.env.example
.mcp.json
README.md                      (magyar)
prisma/
  schema.prisma
  migrations/                  (Prisma által generált SQL)
src/
  index.ts                     (szerver bootstrap)
  app.ts                       (Fastify app factory, route-ok regisztrálása — tesztelhető)
  db/
    client.ts                  (pg Pool a DATABASE_URL-ből)
  geo/
    haversine.ts
    normalize.ts
    geocode.ts
    city-coordinates.json
  routes/
    customers.ts
  seed.ts
test/
  haversine.test.ts
```

## 11. npm scriptek

- `db:up` / `db:down` — Docker Compose Postgres indítás/leállítás
- `migrate` — `prisma migrate deploy` (séma alkalmazása)
- `migrate:dev` — `prisma migrate dev` (fejlesztői migráció generálás)
- `seed` — idempotens betöltés (`tsx src/seed.ts`)
- `dev` — `tsx watch src/index.ts`
- `start` — szerver indítás
- `test` — `vitest run`

## 12. Commit-terv (kis, fókuszált commitok)

1. váz: `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`
2. Prisma séma + `pg` client + kezdeti migráció
3. geo: `normalize` + `city-coordinates.json` + `haversine` + `geocode`
4. haversine Vitest tesztek
5. idempotens seed betöltő
6. Fastify app + mindkét route + szerver bootstrap
7. `.mcp.json` Postgres MCP bekötés
8. README (magyar)
