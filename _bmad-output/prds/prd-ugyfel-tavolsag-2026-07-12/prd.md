---
title: Ügyfél-távolság szolgáltatás (offline REST)
status: final
created: 2026-07-12
updated: 2026-07-12
---

# PRD: Ügyfél-távolság szolgáltatás (offline REST)
*Munkacím — megerősítendő.*

## 0. A dokumentum célja

Ez a PRD egy kicsi, önálló REST szolgáltatás követelményeit rögzíti, amely offline
(külső geokódoló API és futásidejű LLM-hívás nélkül) fut Postgres fölött. A downstream
munkafolyamatok (architektúra, epics & stories, dev) bemenete. A követelmények
feature-ökbe csoportosítva, globálisan sorszámozott FR-ekkel; a rendszerszintű,
nem-funkcionális elvárások külön szekcióban. A technológiai döntés (Node.js + Fastify +
Prisma, Postgres) korábban megtörtént — itt képességként, nem implementációként
szerepel. A lean folyamat és a magyar nyelvű dokumentálás a projekt konvenciója.

## 1. Vízió

Kis, jól körülhatárolt szolgáltatás, amely egy ismert ügyfél-adathalmazt (15 ügyfél a
`seed/seed-customers.json`-ban) betölt Postgresbe, minden ügyfél településéhez lokális
referenciából koordinátát rendel, majd két REST végponton keresztül lekérdezhetővé
teszi: az ügyfelek darabszámát, illetve az ügyfeleket Budapesthez viszonyított
növekvő távolság szerint rendezve.

Az érték a **megbízható offline működésben** és az **idempotens betöltésben** van:
nincs hálózati függés, a seed többszöri futtatása sem duplázza az adatot, az ismeretlen
településű ügyfél pedig nem hiba, hanem kezelt eset (null koordináta). A szolgáltatás
kicsi, tesztelt és reprodukálható — a fejlesztési folyamat kis, fókuszált commitokban
látszik.

## 2. Célfelhasználó

### 2.1 Jobs To Be Done
- Backend/integrációs fejlesztőként **megbízhatóan be akarom tölteni** az ügyfél-seedet,
  anélkül hogy a duplázástól vagy a hálózati elérhetőségtől kellene tartanom.
- Adatfogyasztóként **le akarom kérdezni az ügyfeleket távolság szerint** Budapesthez
  képest, determinisztikus rendezéssel és jól definiált null-kezeléssel.
- Üzemeltetőként **offline, külső függőség nélkül** akarom futtatni fejlesztői gépen
  vagy CI-ben, kevés mozgó alkatrésszel.

### 2.2 Nem-felhasználók (v1)
- Nincs több-felhasználós hitelesítés/authorizáció — a szolgáltatás nem publikus,
  végfelhasználói felület nélküli belső API.
- Nem cél a tetszőleges világszintű geokódolás — csak a seedben előforduló városok.

### 2.3 Fő felhasználói folyamatok
*Egyoperátoros, technikai szolgáltatás — a JTBD lényegében újrafogalmazva; könnyű forma.*

- **UJ-1. A fejlesztő betölti és lekérdezi az ügyfeleket.**
  A fejlesztő elindítja a Postgrest, lefuttatja a migrációt és a seedet (akár kétszer is,
  ellenőrzésképp), majd meghívja a `GET /customers/count` és
  `GET /customers/by-distance` végpontokat, és a várt darabszámot, illetve a
  Budapesthez viszonyított távolság szerint rendezett listát kapja vissza.

## 3. Glosszárium
*A downstream munkafolyamatoknak ezeket a fogalmakat pontosan így kell használniuk.*

- **Ügyfél (customer)** — egy rekord a `customers` táblában: `id`, `name`, `telepules`,
  `lat` (nullable), `lon` (nullable); opcionálisan `budget`, `note`.
- **Település (telepules)** — az ügyfél városa; forrása a seed `location.city` mezője.
- **Geokódoló-referencia** — a repóba bundle-olt, statikus `telepules -> {lat, lon}`
  leképezés a seedben előforduló városokra, ismert koordinátákkal. Nincs külső hívás.
- **Normalizált településnév** — a település neve trimmelve, kisbetűsítve és
  ékezetmentesítve, az egyeztetés kulcsa (pl. „ Kraków " → „krakow").
- **Budapest-referenciapont** — a főváros rögzített koordinátája, amelyhez a
  távolságot számoljuk.
- **distanceKm** — a haversine-nal számolt gömbi távolság kilométerben, 1 tizedesre
  kerekítve; ismeretlen koordináta esetén `null`.
- **Idempotens seed** — a seed betöltés úgy, hogy ismételt futtatás nem hoz létre
  duplikátumot.

## 4. Feature-ök

### 4.1 Adatbetöltés (idempotens seed + geokódolás)
**Leírás:** A szolgáltatás betölti a `seed/seed-customers.json`-t a `customers` táblába,
minden ügyfélhez a Geokódoló-referenciából koordinátát rendel a Normalizált településnév
alapján, és mindezt idempotensen teszi. Realizálja: UJ-1.
`[ASSUMPTION: az idempotencia természetes kulcsa a (name, telepules) pár, mivel a
seedben nincs technikai azonosító és ez a pár egyedi a 15 rekordra.]`

**Functional Requirements:**

#### FR-1: Idempotens seed betöltés
A fejlesztő betöltheti a seedet úgy, hogy kétszeri futtatás sem duplázza a sorokat.

**Következmények (tesztelhető):**
- Üres adatbázison a seed lefuttatása után `customers` sorszám = 15.
- A seed másodszori lefuttatása után `customers` sorszám továbbra is 15.
- Módosított seed-rekord (pl. változott `budget`) ismételt betöltéskor frissül, nem
  keletkezik új sor. `[ASSUMPTION: upsert-szemantika a természetes kulcson.]`

#### FR-2: Lokális, offline geokódolás
A rendszer minden ügyfél településéhez a repóba bundle-olt Geokódoló-referenciából
rendel `lat`/`lon`-t, futásidejű külső hívás nélkül.

**Következmények (tesztelhető):**
- A 15 seed-városmindegyike (Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków,
  Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin, Copenhagen)
  ismert `lat`/`lon`-t kap.
- A betöltés és a végpontok hálózati kapcsolat nélkül is működnek.

**Out of Scope:**
- Tetszőleges, referencián kívüli városok feloldása.

#### FR-3: Robusztus település-egyeztetés
A rendszer a településnevet Normalizált településnévvé alakítja az egyeztetéshez:
trimmelt whitespace, kis/nagybetű-független, ékezetfüggetlen.

**Következmények (tesztelhető):**
- „ budapest ", „Budapest", „BUDAPEST" ugyanarra a referenciára esik.
- „Kraków" és „Krakow" ugyanarra a referenciára esik.
- Budapest (és opcionálisan kerületei, pl. „Budapest III.") a fővárosra esik.
  `[ASSUMPTION: a kerület-kezelés opcionális; a seedben csak sima „Budapest" szerepel.]`

#### FR-4: Ismeretlen település kezelése
Ha egy település nincs a Geokódoló-referenciában, az ügyfél `lat`/`lon` értéke `null`,
a betöltés nem áll le hibával, és az eset naplózásra kerül.

**Következmények (tesztelhető):**
- Referencián kívüli település esetén a rekord bekerül `lat=null, lon=null` értékkel.
- A seed folyamat nem dob kezeletlen kivételt, a többi rekord betöltése folytatódik.
- A hiányzó egyeztetésről log-bejegyzés készül (WARN szint).

### 4.2 Lekérdező végpontok
**Leírás:** Két olvasó REST végpont az ügyfelek lekérdezésére. Realizálja: UJ-1.

**Functional Requirements:**

#### FR-5: Ügyfél darabszám
`GET /customers/count` visszaadja a `customers` tábla tényleges sorszámát.

**Következmények (tesztelhető):**
- Válasz: `{ "count": <egész> }`, ahol az érték a `customers` valós sorszáma.
- Seed után a count = 15.

#### FR-6: Ügyfelek távolság szerint
`GET /customers/by-distance` visszaadja az ügyféllistát Budapesthez viszonyított
**növekvő** távolság szerint, minden elemhez `distanceKm` mezővel.

**Következmények (tesztelhető):**
- Minden elem tartalmaz `distanceKm` mezőt, 1 tizedesre kerekítve.
- Minden elem a teljes ügyfélrekordot adja vissza: `id`, `name`, `telepules`,
  `budget`, `note`, `distanceKm`.
- A budapesti ügyfél(ek) elöl vannak, `distanceKm: 0` (0.0) értékkel.
- Az ismeretlen koordinátájú ügyfelek (lat/lon = null) a lista **végén**,
  `distanceKm: null` értékkel.
- Azonos távolság esetén a rendezés másodlagos kulcsa a `name` (növekvő).
- A `distanceKm` a haversine gömbi távolság; Budapest–Bécs ≈ 214 km ±1 km tűréssel.

**Feature-specifikus NFR-ek:**
- A rendezés determinisztikus (távolság ↑, majd `name` ↑; a null-koordinátájúak stabilan
  a végén, közöttük `name` ↑). `[ASSUMPTION: a null-blokkon belül is name szerint.]`

### 4.3 Minőség és tesztelés
**Leírás:** A távolságszámítás és a hibás bemenetek kezelése unit tesztekkel bizonyított.

#### FR-7: Haversine unit tesztek
A haversine távolságszámítás egységtesztekkel fedett.

**Következmények (tesztelhető):**
- Ismert táv: Budapest–Bécs ≈ 214 km (elfogadható tűréssel, pl. ±1–2 km).
- 0 km eset: Budapest–Budapest = 0.
- Null-koordináta kezelése: ha bármelyik pont koordinátája hiányzik, az eredmény `null`.

## 5. Nem-célok (explicit)
- Nincs külső geokódoló API vagy bármilyen futásidejű hálózati hívás.
- Nincs futásidejű LLM-hívás.
- Nincs hitelesítés/authorizáció, rate limiting, felhasználókezelés.
- Nincs írás/módosítás API-n keresztül (csak olvasó végpontok); az adat a seedből jön.
- Nincs UI/frontend.

## 6. MVP hatókör

### 6.1 Benne van
- Postgres séma + migráció a `customers` táblához.
- Idempotens seed betöltés a `seed/seed-customers.json`-ból.
- Bundle-olt geokódoló-referencia a 15 seed-városra, normalizált egyeztetéssel.
- `GET /customers/count` és `GET /customers/by-distance` végpontok.
- Haversine unit tesztek.
- README (Postgres indítás, migráció, seed, szerver, tesztek).
- Postgres MCP bekötése fejlesztéshez (séma és adat láthatóság).

### 6.2 MVP-n kívül
- Kerület-szintű Budapest-bontás (opcionális, csak ha kell) — a seedben nincs rá igény.
- Referencián kívüli városok bővítése / dinamikus geokódolás — [NOTE FOR PM: később
  bővíthető, ha új városok kerülnek a seedbe].
- Lapozás, szűrés, egyéb query paraméterek a végpontokon.
- Konténerizált deploy, CI pipeline (a README kézi lépéseken túl).

## 7. Sikermetrikák

**Primary**
- **SM-1**: Idempotencia — a seed kétszeri futtatása után a count változatlanul 15.
  Validálja FR-1.
- **SM-2**: Helyes rendezés és távolság — a `by-distance` válasz növekvő `distanceKm`
  szerint rendezett, Budapest 0.0-val elöl, null-koordináták a végén; Budapest–Bécs
  ≈ 214 km. Validálja FR-6, FR-7.

**Secondary**
- **SM-3**: Offline működés — a betöltés és a végpontok hálózat nélkül is működnek.
  Validálja FR-2.

**Counter-metrikák (ne optimalizáld)**
- **SM-C1**: Ne „javítsuk" a lefedettséget a referencia felduzzasztásával — csak a
  seedben ténylegesen előforduló városok kellenek. Ellensúlyozza SM-3-at.

## 8. Nyitott kérdések (lezárva)
1. ✅ A `budget` és `note` mezőket **tároljuk** a `customers` táblában.
2. ✅ A `by-distance` válasz a **teljes rekordot** adja: `id`, `name`, `telepules`,
   `budget`, `note`, `distanceKm`.
3. ✅ **Prisma Migrate** (verziózott migrációs fájlok a repóban).

## 9. Assumptions Index
- §4.1 FR-1 — az idempotencia természetes kulcsa a `(name, telepules)` pár (upsert).
- §4.1 FR-3 — a Budapest-kerület kezelés opcionális; a seedben csak „Budapest" van.
- §4.2 FR-6 — a null-koordinátájú blokkon belül is `name` szerinti a rendezés.
- *(Lezárva §8-ban: budget/note tárolva; by-distance teljes rekord; Prisma Migrate.)*

---

## Cross-Cutting NFR-ek (rendszerszintű)

- **Offline-first:** futásidőben semmilyen külső hálózati hívás (geokódoló, LLM) nem
  történik. A geokódoló-referencia a repóban statikusan bundle-olt.
- **Idempotencia:** a seed betöltés ismételhető mellékhatás nélkül (nincs duplázás).
- **Hibatűrés:** hiányzó/ismeretlen település nem állítja le a betöltést; naplózva,
  `null` koordinátával folytatódik.
- **Determinizmus:** a `by-distance` rendezés minden futáskor ugyanazt a sorrendet adja.
- **Fejleszthetőség:** Postgres MCP bekötve, hogy fejlesztés közben a séma és az adat
  látható legyen.
- **Reprodukálhatóság:** README-ből követhető a teljes futtatás (Postgres, migráció,
  seed, szerver, tesztek); kis, fókuszált commitok.
