# Ügyfél-távolság szolgáltatás (offline REST)

Kis, önálló REST szolgáltatás Postgres fölött. **Offline** fut: nincs külső geokódoló
API és nincs futásidejű LLM-hívás. Betölti a `seed/seed-customers.json`-t (15 ügyfél),
minden ügyfél településéhez egy lokális, a repóba bundle-olt referenciából koordinátát
rendel, majd két végponton lekérdezhetővé teszi az adatot.

- **Stack:** TypeScript (Node.js + Fastify + Prisma + PostgreSQL), tsx futtató, Vitest
  tesztek (futásidejű + statikus type tesztek).
- **Tervdokumentumok:** [PRD](_bmad-output/prds/prd-ugyfel-tavolsag-2026-07-12/prd.md) ·
  [Architektúra-spine](_bmad-output/architecture/architecture-ugyfel-tavolsag-2026-07-12/ARCHITECTURE-SPINE.md) ·
  [Epikák & story-k](_bmad-output/epics.md)

## Előfeltételek

- **Node.js** ≥ 20 (fejlesztve: v22)
- **Docker** + Docker Compose (a helyi Postgreshez)

## Gyors indítás

```bash
# 1. Függőségek
npm install

# 2. Környezeti változók (a példából)
cp .env.example .env
#   DATABASE_URL="postgresql://app:app@localhost:5433/customers?schema=public"
#   PORT=3000

# 3. Postgres indítása (Docker, a host 5433-as portján)
npm run db:up

# 4. Migráció (a customers tábla létrehozása)
npm run migrate        # prisma migrate deploy

# 5. Seed (idempotens – kétszer is futtatható duplázás nélkül)
npm run seed

# 6. Szerver indítása (tsx-szel, build nélkül)
npm start              # http://localhost:3000

# 7. Tesztek (offline, DB nélkül futnak)
npm test               # futásidejű tesztek
npm run test:types     # statikus type tesztek
npm run typecheck      # tsc típusellenőrzés
```

## NPM scriptek

| Script | Mit csinál |
| --- | --- |
| `npm run db:up` / `db:down` | Postgres konténer indítása / leállítása |
| `npm run migrate` | `prisma migrate deploy` – verziózott migrációk alkalmazása |
| `npm run migrate:dev` | `prisma migrate dev` – új migráció fejlesztéskor |
| `npm run seed` | `tsx scripts/seed.ts` – idempotens betöltés + geokódolás |
| `npm start` / `npm run dev` | Fastify szerver tsx-szel (a `dev` figyeli a változásokat) |
| `npm test` | Vitest futásidejű tesztek |
| `npm run test:types` | Vitest statikus type tesztek (`*.test-d.ts`, `expectTypeOf`) |
| `npm run typecheck` | `tsc` típusellenőrzés (nincs emit) |
| `npm run generate` | Prisma Client generálás |

## Végpontok

### `GET /customers/count`

Az ügyfelek tényleges darabszáma.

```bash
curl http://localhost:3000/customers/count
```

```json
{ "count": 15 }
```

### `GET /customers/by-distance`

Ügyfelek **növekvő távolság** szerint Budapesthez képest. Minden elem a teljes rekordot
adja + `distanceKm` (1 tizedesre kerekítve). A budapesti ügyfelek elöl (`0`), az
ismeretlen koordinátájúak a lista végén (`distanceKm: null`). Holtverseny esetén `name`
szerint.

```bash
curl http://localhost:3000/customers/by-distance
```

```json
[
  {
    "id": 1,
    "name": "Anna Kovács",
    "telepules": "Budapest",
    "budget": 850,
    "note": "Loves lush, jungle-style rooms ...",
    "distanceKm": 0
  },
  {
    "id": 2,
    "name": "Lena Fischer",
    "telepules": "Vienna",
    "budget": 950,
    "note": "Prefers architectural, sculptural plants ...",
    "distanceKm": 214
  }
]
```

(A teljes lista Bécstől Lisszabonig, `2469.4` km-ig tart.)

### `GET /health`

Egészség-ellenőrzés: `{ "status": "ok" }`.

## Hogyan működik a geokódolás (offline)

- A `src/lib/geo-reference.js` egy statikus, a repóba bundle-olt `telepules → {lat, lon}`
  referencia a seedben előforduló 15 városra, ismert koordinátákkal. **Nincs külső hívás.**
- Az egyeztetés a `src/lib/normalize.js` `normalizeTown()`-jával történik: trim +
  kis/nagybetű-független + ékezetfüggetlen (pl. `" Kraków "` → `krakow`).
- A koordináta-hozzárendelés a **seed idején** megtörténik és a DB-be íródik.
- Ha egy település nincs a referenciában: `lat`/`lon` = `null`, WARN log, a betöltés
  **nem áll le** – megy tovább.

## Projektstruktúra

```
src/
  types.ts    megosztott domain típusok (Coord, CustomerRecord, RankedCustomer, …)
  lib/        normalize.ts, geo-reference.ts, haversine.ts, rank.ts  (pure, tesztelhető)
  data/       prisma.ts (singleton), customers-repo.ts
  services/   seed-service.ts, customers-service.ts
  routes/     customers.ts
  app.ts, server.ts
prisma/       schema.prisma + migrations/
scripts/      seed.ts
test/         *.test.ts (futásidejű) + types.test-d.ts (type tesztek)
```

## Postgres MCP (fejlesztéshez)

A repó tartalmaz egy projekt-szintű MCP-bekötést ([.mcp.json](.mcp.json)), amely a helyi
Postgreshez köti a `@modelcontextprotocol/server-postgres` szervert – így fejlesztés
közben látható a **séma és az adat** (read-only). A projekt-szintű MCP-szervereket a
Claude Code a következő indításkor jóváhagyásra felkínálja.

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://app:app@localhost:5433/customers"]
    }
  }
}
```

> A connection string helyi, eldobható fejlesztői hitelesítőt tartalmaz (`app:app`),
> a `docker-compose.yml`-lel összhangban.

## Tesztek

A Vitest tesztek **DB nélkül**, offline futnak (a lényegi logika pure függvényekben van):

- `test/haversine.test.ts` – Budapest–Bécs ≈ 214 km, 0 km eset, null-koordináta.
- `test/normalize.test.ts` – ékezet/kis-nagybetű/trim, referencia-lookup.
- `test/seed-mapping.test.ts` – ismert/ismeretlen település geokódolása.
- `test/by-distance.test.ts` – rendezés (Budapest elöl, null a végén, name holtverseny),
  nyers-táv rendezés és float-biztos kerekítés.

**Type tesztek** (`npm run test:types`) – statikus, `expectTypeOf`/`assertType` alapon:

- `test/types.test-d.ts` – a függvények szerződései (pl. `haversineKm` → `number | null`,
  `rankByDistance` → `RankedCustomer[]`), a válasz-alak (nincs `lat`/`lon`/`distance`),
  és egy **drift-őr**, ami a `CustomerRecord`-ot a Prisma `Customer` modellhez köti.
