---
stepsCompleted: ["step-01", "step-02", "step-03"]
inputDocuments:
  - _bmad-output/prds/prd-ugyfel-tavolsag-2026-07-12/prd.md
  - _bmad-output/architecture/architecture-ugyfel-tavolsag-2026-07-12/ARCHITECTURE-SPINE.md
---

# Ügyfél-távolság szolgáltatás (offline REST) - Epic Breakdown

## Overview

Ez a dokumentum a teljes epic- és story-bontást tartalmazza az Ügyfél-távolság
szolgáltatáshoz, a PRD követelményeit és az architektúra döntéseit implementálható,
**apró, commit-méretű** story-kra bontva. A story-k sorrendben, egymásra épülve, jövőbeli
függőség nélkül elvégezhetők — így a fejlesztési folyamat kis commitokban látszik.

## Requirements Inventory

### Functional Requirements

- **FR1 (PRD FR-1):** Idempotens seed betöltés — kétszeri futtatás sem duplázza a sorokat.
- **FR2 (PRD FR-2):** Lokális, offline geokódolás bundle-olt referenciából, külső hívás nélkül.
- **FR3 (PRD FR-3):** Robusztus település-egyeztetés: trim + kis/nagybetű-független + ékezetfüggetlen.
- **FR4 (PRD FR-4):** Ismeretlen település → lat/lon null, WARN log, nincs crash, folytatódik.
- **FR5 (PRD FR-5):** `GET /customers/count` → `{ "count": <egész> }`, a valós sorszám.
- **FR6 (PRD FR-6):** `GET /customers/by-distance` → növekvő táv Budapesthez; distanceKm 1 tizedes; Budapest 0.0 elöl; null-koord a végén distanceKm:null; holtverseny name szerint; teljes rekord.
- **FR7 (PRD FR-7):** Haversine unit tesztek: Budapest–Bécs ≈ 214 km, 0 km eset, null-koordináta.

### NonFunctional Requirements

- **NFR1 Offline-first:** futásidőben semmilyen külső hálózati hívás (geokódoló/LLM).
- **NFR2 Idempotencia:** a seed ismételhető mellékhatás nélkül.
- **NFR3 Hibatűrés:** hiányzó település nem állítja le a betöltést; naplózva, null koordinátával folytatódik.
- **NFR4 Determinizmus:** a by-distance rendezés minden futáskor ugyanaz.
- **NFR5 Fejleszthetőség:** Postgres MCP bekötve (séma+adat láthatóság).
- **NFR6 Reprodukálhatóság:** README-ből követhető a teljes futtatás; kis, fókuszált commitok.

### Additional Requirements

- Rétegzett struktúra (routes → services → data; lib pure) — architektúra AD-1.
- Egyetlen `normalizeTown` az egyeztetéshez — AD-2.
- Geokódolás betöltéskor, koordináta a DB-be perzisztálva — AD-3.
- `customers` egyedi megszorítás `(name, telepules)`-en, `upsert` seed — AD-4.
- Prisma Migrate (verziózott migrációk).
- Helyi Postgres `docker-compose`-zal; env `DATABASE_URL`.
- Vitest tesztkeret.

### UX Design Requirements

Nincs UI — a szolgáltatásnak nincs frontendje, így nincs UX-DR.

### FR Coverage Map

| Követelmény | Lefedő story |
| --- | --- |
| (váz) | Story 1.1 |
| (séma) FR1 alap | Story 1.2 |
| FR3 | Story 1.3 |
| FR2 (referencia) | Story 1.3 |
| FR7 | Story 1.4 |
| FR1, FR2, FR3, FR4 | Story 1.5 |
| FR5 | Story 1.6 |
| FR6 | Story 1.7 |
| NFR5, NFR6 | Story 1.8 |

## Epic List

- **Epic 1: Offline ügyfél-távolság szolgáltatás** — a teljes szolgáltatás felépítése a
  projekt-váztól az olvasó végpontokig és a README/MCP bekötésig, apró story-kban.

## Epic 1: Offline ügyfél-távolság szolgáltatás

A cél egy futtatható, tesztelt offline REST szolgáltatás: Postgres séma + idempotens seed
+ lokális geokódolás + két olvasó végpont, kis, egymásra épülő lépésekben.

### Story 1.1: Projekt-váz és helyi Postgres

As a fejlesztő,
I want egy futtatható Fastify projekt-vázat és helyi Postgrest,
So that legyen mire építeni a további story-kat.

**Acceptance Criteria:**

**Given** üres/kezdeti repo a megadott stackkel (Node.js + Fastify + Prisma),
**When** inicializálom a projektet (package.json, Fastify `app.js`/`server.js`, `docker-compose.yml` Postgres, `.env` a `DATABASE_URL`-lel, Prisma init),
**Then** a `docker compose up -d` elindít egy Postgrest,
**And** a szerver elindul és egy `GET /health` (vagy gyökér) 200-at ad,
**And** a rétegmappák léteznek: `src/{routes,services,data,lib}`, `scripts/`, `test/`.

### Story 1.2: Customer séma és migráció

As a fejlesztő,
I want a `customers` Prisma-modellt és verziózott migrációt,
So that legyen hova betölteni és lekérdezni az ügyfeleket.

**Acceptance Criteria:**

**Given** a futó Postgres és a Prisma setup,
**When** definiálom a `Customer` modellt (`id`, `name`, `telepules`, `lat` nullable, `lon` nullable, `budget` nullable, `note` nullable) `@@unique([name, telepules])`-szel és futtatom a `prisma migrate`-et,
**Then** a `customers` tábla létrejön a megadott oszlopokkal és az egyedi megszorítással,
**And** a migrációs fájl bekerül a `prisma/migrations/` mappába (verziózott),
**And** a Prisma Client generálódik és importálható a `src/data/prisma.js`-ből.

### Story 1.3: Normalizálás és geokódoló-referencia

As a fejlesztő,
I want egy `normalizeTown` util-t és egy bundle-olt `telepules -> {lat,lon}` referenciát a 15 városra,
So that offline, robusztusan egyeztethető a település koordinátára.

**Acceptance Criteria:**

**Given** a lib réteg,
**When** implementálom a `src/lib/normalize.js` `normalizeTown(s)`-t (trim → lowercase → NFD + diakritikus jelek eltávolítása) és a `src/lib/geo-reference.js`-t a 15 város (Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Copenhagen, Dublin) ismert koordinátáival, normalizált kulcsokkal, plusz a `BUDAPEST` konstanssal,
**Then** `normalizeTown(" Kraków ") === "krakow"` és `normalizeTown("BUDAPEST") === "budapest"`,
**And** a referencia lookup a normalizált kulccsal megtalálja mind a 15 várost,
**And** ismeretlen településre a lookup `null`/`undefined`-et ad (nem dob),
**And** unit teszt fedi a normalizálást (ékezet, kis/nagybetű, trim).

### Story 1.4: Haversine util és unit tesztek (FR7)

As a fejlesztő,
I want egy pure, null-biztos haversine függvényt tesztekkel,
So that megbízhatóan és tesztelten számoljak távolságot.

**Acceptance Criteria:**

**Given** a lib réteg,
**When** implementálom a `src/lib/haversine.js`-t (két `{lat,lon}` pont → km, R=6371, ha bármely koordináta hiányzik → `null`) és Vitest teszteket írok,
**Then** a Budapest–Bécs táv ≈ 214 km (±2 km tűrés) — teszt zöld,
**And** a Budapest–Budapest táv = 0 — teszt zöld,
**And** hiányzó koordináta esetén az eredmény `null` (nem dob) — teszt zöld,
**And** `npm test` sikeresen lefut.

### Story 1.5: Idempotens seed és geokódolás (FR1–FR4)

As a fejlesztő,
I want egy idempotens seed scriptet, ami betölti a 15 ügyfelet és geokódolja őket,
So that reprodukálhatóan, duplázás nélkül legyen adat az adatbázisban.

**Acceptance Criteria:**

**Given** a migrált `customers` tábla, a `normalizeTown`, a geo-reference és a `seed/seed-customers.json`,
**When** lefuttatom a `node scripts/seed.js`-t (a `seed-service` `upsert`-tel a `(name, telepules)` kulcson, minden ügyfélhez a referenciából rendel `lat/lon`-t),
**Then** a `customers` sorszám = 15, minden ismert városhoz kitöltött `lat/lon`,
**And** a script MÁSODik futtatása után is a sorszám = 15 (nincs duplázás),
**And** ha egy település nincs a referenciában, a rekord `lat=null, lon=null` értékkel bekerül, WARN log készül, a folyamat nem áll le,
**And** a betöltés hálózati kapcsolat nélkül is sikeres (offline).

### Story 1.6: GET /customers/count végpont (FR5)

As a kliens,
I want lekérdezni az ügyfelek darabszámát,
So that ellenőrizhessem a betöltött rekordok számát.

**Acceptance Criteria:**

**Given** a futó szerver és a betöltött adat,
**When** meghívom a `GET /customers/count`-ot,
**Then** a válasz `{ "count": <egész> }`, ahol az érték a `customers` valós sorszáma,
**And** seed után a `count` = 15,
**And** üres táblán a `count` = 0 (nem hibázik).

### Story 1.7: GET /customers/by-distance végpont (FR6)

As a kliens,
I want az ügyfeleket Budapesthez viszonyított növekvő távolság szerint,
So that lássam, kik vannak a legközelebb.

**Acceptance Criteria:**

**Given** a futó szerver és a geokódolt adat,
**When** meghívom a `GET /customers/by-distance`-t,
**Then** a lista növekvő `distanceKm` szerint rendezett, minden elem a teljes rekordot adja (`id`, `name`, `telepules`, `budget`, `note`, `distanceKm`),
**And** a `distanceKm` 1 tizedesre kerekített,
**And** a budapesti ügyfél(ek) elöl vannak `distanceKm: 0.0`-val,
**And** az ismeretlen koordinátájú ügyfelek a lista végén, `distanceKm: null` értékkel,
**And** azonos távolság esetén (és a null-blokkon belül is) a rendezés `name` szerint növekvő.

### Story 1.8: README és Postgres MCP bekötés

As a fejlesztő,
I want teljes README-t és bekötött Postgres MCP-t,
So that bárki reprodukálhatóan futtathassa, és fejlesztés közben lássa a sémát/adatot.

**Acceptance Criteria:**

**Given** a kész szolgáltatás,
**When** megírom a README-t és bekötöm a Postgres MCP-t a `DATABASE_URL`-re,
**Then** a README leírja: Postgres indítás (docker), migráció, seed, szerver indítás, tesztek futtatása,
**And** a README dokumentálja a két végpontot példaválaszokkal,
**And** a Postgres MCP a fejlesztői környezetből lekérdezi a `customers` sémát és sorszámot,
**And** a lépések követésével a szolgáltatás tiszta gépen is elindítható.
