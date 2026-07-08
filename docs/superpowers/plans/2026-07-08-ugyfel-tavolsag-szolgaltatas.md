# Ügyfél-távolság szolgáltatás — megvalósítási terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline REST szolgáltatás Postgres fölött, amely idempotensen betölti a seed ügyfeleket, lokálisan geokódolja a településeiket, és távolság szerint rendezve szolgáltatja őket Budapesthez képest.

**Architecture:** Fastify HTTP réteg + `pg` nyers SQL a lekérdezésekhez. Prisma kizárólag a sémát és a migrációkat kezeli (soha nem lekérdez). A geokódolás egy repóba bundle-olt JSON referenciából történik; a haversine távolság egy tiszta, unit-tesztelt modul, amelyet a végpont és a teszt közösen használ.

**Tech Stack:** Node.js 22 + TypeScript (ESM, tsx futtatás, nincs fordítási lépés), Fastify 5, `pg` 8, Prisma 6 (csak séma+migráció), Vitest, PostgreSQL 16 Docker Compose-ban.

## Global Constraints

Minden taskra érvényes, a specifikációból szó szerint átemelve:

- **Offline futásidő:** nincs külső geokódoló API-hívás, nincs LLM-hívás futásidőben.
- **Prisma csak sémára/migrációra:** a `@prisma/client` futásidőben **nincs importálva**; minden futásidejű lekérdezés `pg` nyers, paraméterezett SQL.
- **Nyelv:** minden generált dokumentum (README, tervek) **magyar**; a kód, azonosítók, commit-üzenetek angolok; az adatmodell mezőneve `telepules`.
- **Adatmodell:** `customers(id, name, telepules, lat nullable, lon nullable, budget nullable, note nullable)`, egyedi kulcs `(name, telepules)`.
- **`distanceKm`:** Budapesttől mért haversine távolság, **1 tizedesre kerekítve**; a budapesti ügyfelek `0.0`; ismeretlen koordinátájú ügyfelek a lista **végén**, `distanceKm: null`; holtverseny esetén `name` szerint növekvő.
- **Modulrendszer:** package.json `"type": "module"`, futtatás `tsx`-szel (nincs `tsc` build kimenet).
- **Idempotens seed:** kétszeri futtatás után a darabszám 15 marad.
- **DATABASE_URL:** `postgresql://app:app@localhost:5433/customers?schema=public` (a Docker Postgres a 5433 host-porton, hogy ne ütközzön egy helyi 5432-es klaszterrel).

---

### Task 1: Projektváz és függőségek

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes: semmit (első task).
- Produces: futtatható npm scriptek (`db:up`, `db:down`, `migrate`, `migrate:dev`, `seed`, `dev`, `start`, `typecheck`, `test`); Docker Postgres a `localhost:5433`-on; `DATABASE_URL` konvenció.

- [ ] **Step 1: Hozd létre a `package.json`-t (scriptek, `type: module`, még függőségek nélkül)**

```json
{
  "name": "customer-distance-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "db:up": "docker compose up -d --wait",
    "db:down": "docker compose down",
    "migrate": "prisma migrate deploy",
    "migrate:dev": "prisma migrate dev",
    "seed": "tsx src/seed.ts",
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Telepítsd a függőségeket (npm írja be a verziókat)**

Run:
```bash
npm install fastify pg
npm install -D prisma @prisma/client tsx typescript vitest @types/node @types/pg
```
Expected: sikeres telepítés, létrejön a `node_modules/` és a `package-lock.json`; a `package.json`-ba bekerül a `dependencies` és `devDependencies` blokk.

- [ ] **Step 3: Hozd létre a `tsconfig.json`-t**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Hozd létre a `docker-compose.yml`-t**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: customers
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d customers"]
      interval: 3s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

- [ ] **Step 5: Hozd létre a `.env.example`-t**

```
DATABASE_URL="postgresql://app:app@localhost:5433/customers?schema=public"
PORT=3000
```

- [ ] **Step 6: Ellenőrizd a Docker Compose konfigot**

Run: `docker compose config`
Expected: érvényes, feloldott YAML kimenet, hibaüzenet nélkül.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json docker-compose.yml .env.example
git commit -m "chore: scaffold project (package.json, tsconfig, docker compose)"
```

---

### Task 2: Prisma séma, migráció és pg kliens

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/env.ts`
- Create: `src/db/client.ts`
- Create: `prisma/migrations/**` (a `migrate dev` generálja)
- Create (local, gitignored): `.env`

**Interfaces:**
- Consumes: `DATABASE_URL` (Task 1).
- Produces: `customers` tábla a `(name, telepules)` egyedi indexszel; `pool` (`pg.Pool`) export a `src/db/client.ts`-ből; env-betöltő side effect a `src/env.ts`-ből.

- [ ] **Step 1: Hozd létre a `prisma/schema.prisma`-t**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id        Int     @id @default(autoincrement())
  name      String
  telepules String
  lat       Float?
  lon       Float?
  budget    Int?
  note      String?

  @@unique([name, telepules])
  @@map("customers")
}
```

- [ ] **Step 2: Hozd létre a helyi `.env`-et (gitignore-olt) a migrációhoz és a futtatáshoz**

Run: `cp .env.example .env`
Expected: létrejön a `.env` (a `.gitignore` már kizárja).

- [ ] **Step 3: Hozd létre a `src/env.ts` env-betöltőt**

A `.env`-et a legelső importként töltjük be, hogy a `pool` létrehozása előtt már a `process.env`-ben legyen a `DATABASE_URL`.

```ts
// A .env legelső importként töltődik be, hogy minden más modul előtt fusson le.
try {
  process.loadEnvFile();
} catch {
  // A .env opcionális; ha nincs, a meglévő process.env értékekre támaszkodunk.
}
```

- [ ] **Step 4: Hozd létre a `src/db/client.ts` pg pool-t**

```ts
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

- [ ] **Step 5: Indítsd el a Postgres-t**

Run: `npm run db:up`
Expected: a `db` konténer elindul és healthy állapotba kerül (a `--wait` addig blokkol).

- [ ] **Step 6: Generáld és alkalmazd a kezdeti migrációt**

Run: `npx prisma migrate dev --name init`
Expected: létrejön a `prisma/migrations/<timestamp>_init/migration.sql`, alkalmazódik a `customers` tábla, és a kimenet tartalmazza: `Your database is now in sync with your schema.`

- [ ] **Step 7: Ellenőrizd a sémát**

Run: `docker compose exec -T db psql -U app -d customers -c "\d customers"`
Expected: a tábla oszlopai `id, name, telepules, lat, lon, budget, note`, és látszik a `customers_name_telepules_key` egyedi index.

- [ ] **Step 8: Ellenőrizd a típusokat**

Run: `npm run typecheck`
Expected: hibamentes lefutás.

- [ ] **Step 9: Commit** (a `.env`-et NEM commitoljuk)

```bash
git add prisma/schema.prisma prisma/migrations src/env.ts src/db/client.ts
git commit -m "feat: add Prisma schema, initial migration and pg pool"
```

---

### Task 3: Haversine távolságmodul (TDD)

**Files:**
- Create: `test/haversine.test.ts`
- Create: `src/geo/haversine.ts`

**Interfaces:**
- Consumes: semmit.
- Produces:
  - `interface Coord { lat: number; lon: number }`
  - `const BUDAPEST: Coord` = `{ lat: 47.4979, lon: 19.0402 }`
  - `haversineKm(a: Coord, b: Coord): number`
  - `distanceFromBudapestKm(point: { lat: number | null; lon: number | null }): number | null`

- [ ] **Step 1: Írd meg a bukó tesztet**

`test/haversine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { haversineKm, distanceFromBudapestKm, BUDAPEST } from '../src/geo/haversine';

describe('haversineKm', () => {
  it('Budapest → Bécs ≈ 214 km', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const d = haversineKm(BUDAPEST, vienna);
    expect(d).toBeGreaterThan(209);
    expect(d).toBeLessThan(219);
  });

  it('Budapest → Budapest = 0 km', () => {
    expect(haversineKm(BUDAPEST, BUDAPEST)).toBe(0);
  });
});

describe('distanceFromBudapestKm', () => {
  it('null, ha a lat hiányzik', () => {
    expect(distanceFromBudapestKm({ lat: null, lon: 19.0402 })).toBeNull();
  });

  it('null, ha a lon hiányzik', () => {
    expect(distanceFromBudapestKm({ lat: 47.4979, lon: null })).toBeNull();
  });

  it('0 a budapesti koordinátára', () => {
    expect(distanceFromBudapestKm(BUDAPEST)).toBe(0);
  });
});
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/geo/haversine"` (a modul még nem létezik).

- [ ] **Step 3: Írd meg a minimális implementációt**

`src/geo/haversine.ts`:
```ts
export interface Coord {
  lat: number;
  lon: number;
}

export const BUDAPEST: Coord = { lat: 47.4979, lon: 19.0402 };

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function distanceFromBudapestKm(point: {
  lat: number | null;
  lon: number | null;
}): number | null {
  if (point.lat === null || point.lon === null) {
    return null;
  }
  return haversineKm(BUDAPEST, { lat: point.lat, lon: point.lon });
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS — mind az 5 teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add test/haversine.test.ts src/geo/haversine.ts
git commit -m "feat: add haversine distance module with unit tests"
```

---

### Task 4: Normalizálás, koordináta-referencia és geokódolás (TDD)

**Files:**
- Create: `test/geocode.test.ts`
- Create: `src/geo/normalize.ts`
- Create: `src/geo/city-coordinates.json`
- Create: `src/geo/geocode.ts`

**Interfaces:**
- Consumes: `Coord` (Task 3, csak típusként, opcionális).
- Produces:
  - `normalize(value: string): string`
  - `geocode(city: string): { lat: number | null; lon: number | null }`

- [ ] **Step 1: Írd meg a bukó tesztet**

`test/geocode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalize } from '../src/geo/normalize';
import { geocode } from '../src/geo/geocode';

describe('normalize', () => {
  it('ékezet-, kis/nagybetű- és whitespace-független', () => {
    expect(normalize('  Kraków ')).toBe('krakow');
    expect(normalize('KRAKOW')).toBe('krakow');
    expect(normalize('Budapest')).toBe('budapest');
  });

  it('a belső whitespace-t egyetlen szóközzé vonja össze', () => {
    expect(normalize('New   York')).toBe('new york');
  });
});

describe('geocode', () => {
  it('ismert városra koordinátát ad (ékezettel is)', () => {
    const r = geocode('Kraków');
    expect(r.lat).toBeCloseTo(50.0647, 3);
    expect(r.lon).toBeCloseTo(19.945, 3);
  });

  it('Budapest kerülete is a fővárosra esik', () => {
    const r = geocode('Budapest XI.');
    expect(r.lat).toBeCloseTo(47.4979, 3);
    expect(r.lon).toBeCloseTo(19.0402, 3);
  });

  it('ismeretlen település esetén null koordináta', () => {
    expect(geocode('Atlantisz')).toEqual({ lat: null, lon: null });
  });
});
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/geo/normalize"` (a modulok még nem léteznek).

- [ ] **Step 3: Írd meg a `src/geo/normalize.ts`-t**

```ts
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Hozd létre a `src/geo/city-coordinates.json`-t (a 15 seed-város)**

```json
{
  "budapest": { "lat": 47.4979, "lon": 19.0402 },
  "vienna": { "lat": 48.2082, "lon": 16.3738 },
  "munich": { "lat": 48.1351, "lon": 11.582 },
  "milan": { "lat": 45.4642, "lon": 9.19 },
  "barcelona": { "lat": 41.3874, "lon": 2.1686 },
  "lyon": { "lat": 45.764, "lon": 4.8357 },
  "krakow": { "lat": 50.0647, "lon": 19.945 },
  "prague": { "lat": 50.0755, "lon": 14.4378 },
  "lisbon": { "lat": 38.7223, "lon": -9.1393 },
  "amsterdam": { "lat": 52.3676, "lon": 4.9041 },
  "stockholm": { "lat": 59.3293, "lon": 18.0686 },
  "ljubljana": { "lat": 46.0569, "lon": 14.5058 },
  "bucharest": { "lat": 44.4268, "lon": 26.1025 },
  "dublin": { "lat": 53.3498, "lon": -6.2603 },
  "copenhagen": { "lat": 55.6761, "lon": 12.5683 }
}
```

- [ ] **Step 5: Írd meg a `src/geo/geocode.ts`-t**

```ts
import coordinates from './city-coordinates.json';
import { normalize } from './normalize';

interface Coord {
  lat: number;
  lon: number;
}

const table = coordinates as Record<string, Coord>;

export function geocode(city: string): { lat: number | null; lon: number | null } {
  const key = normalize(city);

  // Budapest-szabály: a kerületek (pl. "Budapest XI.") is a fővárosra esnek.
  if (key.startsWith('budapest')) {
    return { ...table.budapest };
  }

  const hit = table[key];
  if (hit) {
    return { lat: hit.lat, lon: hit.lon };
  }

  return { lat: null, lon: null };
}
```

- [ ] **Step 6: Futtasd, és győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS — a haversine és a geocode tesztek is zöldek.

- [ ] **Step 7: Commit**

```bash
git add test/geocode.test.ts src/geo/normalize.ts src/geo/city-coordinates.json src/geo/geocode.ts
git commit -m "feat: add offline geocoding (normalize + city reference + lookup)"
```

---

### Task 5: Idempotens seed betöltő

**Files:**
- Create: `src/seed.ts`

**Interfaces:**
- Consumes: `pool` (Task 2), `geocode` (Task 4), `seed/seed-customers.json`, `src/env.ts` side effect.
- Produces: `npm run seed` — idempotens upsert a `customers` táblába.

- [ ] **Step 1: Írd meg a `src/seed.ts`-t**

```ts
import './env';
import { readFile } from 'node:fs/promises';
import { pool } from './db/client';
import { geocode } from './geo/geocode';

interface SeedRecord {
  name: string;
  budget?: number;
  location: { city: string; countryCode: string };
  note?: string;
}

async function main(): Promise<void> {
  const path = new URL('../seed/seed-customers.json', import.meta.url);
  const records: SeedRecord[] = JSON.parse(await readFile(path, 'utf8'));

  let geocoded = 0;
  let missing = 0;

  for (const record of records) {
    const { lat, lon } = geocode(record.location.city);
    if (lat === null) {
      missing += 1;
      console.warn(
        `[seed] Nincs koordináta ehhez a településhez: "${record.location.city}" (${record.name})`,
      );
    } else {
      geocoded += 1;
    }

    await pool.query(
      `INSERT INTO customers (name, telepules, lat, lon, budget, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name, telepules) DO UPDATE
         SET lat = EXCLUDED.lat,
             lon = EXCLUDED.lon,
             budget = EXCLUDED.budget,
             note = EXCLUDED.note`,
      [record.name, record.location.city, lat, lon, record.budget ?? null, record.note ?? null],
    );
  }

  console.log(
    `[seed] Kész. Feldolgozva: ${records.length}, geokódolva: ${geocoded}, hiányzó koordináta: ${missing}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error('[seed] Hiba:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Futtasd a seedet egyszer**

Run: `npm run seed`
Expected: kimenet `[seed] Kész. Feldolgozva: 15, geokódolva: 15, hiányzó koordináta: 0`.

- [ ] **Step 3: Ellenőrizd a darabszámot**

Run: `docker compose exec -T db psql -U app -d customers -c "SELECT count(*) FROM customers;"`
Expected: `15`.

- [ ] **Step 4: Futtasd MÉGEGYSZER, és igazold az idempotenciát**

Run: `npm run seed && docker compose exec -T db psql -U app -d customers -c "SELECT count(*) FROM customers;"`
Expected: a darabszám továbbra is `15` (nincs duplázódás).

- [ ] **Step 5: Commit**

```bash
git add src/seed.ts
git commit -m "feat: add idempotent seed loader with local geocoding"
```

---

### Task 6: Fastify app és végpontok

**Files:**
- Create: `src/routes/customers.ts`
- Create: `src/app.ts`
- Create: `src/index.ts`

**Interfaces:**
- Consumes: `pool` (Task 2), `distanceFromBudapestKm` (Task 3), `src/env.ts` side effect.
- Produces: `buildApp(): FastifyInstance`; `GET /customers/count`; `GET /customers/by-distance`.

- [ ] **Step 1: Írd meg a `src/routes/customers.ts`-t**

```ts
import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client';
import { distanceFromBudapestKm } from '../geo/haversine';

interface CustomerRow {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customers/count', async () => {
    const result = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM customers',
    );
    return { count: result.rows[0].count };
  });

  app.get('/customers/by-distance', async () => {
    const result = await pool.query<CustomerRow>(
      'SELECT id, name, telepules, lat, lon, budget, note FROM customers',
    );

    const withDistance = result.rows.map((row) => {
      const distance = distanceFromBudapestKm(row);
      return {
        ...row,
        distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
      };
    });

    withDistance.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) {
        return a.name.localeCompare(b.name);
      }
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name);
    });

    return withDistance;
  });
}
```

- [ ] **Step 2: Írd meg a `src/app.ts`-t**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { customerRoutes } from './routes/customers';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.register(customerRoutes);
  return app;
}
```

- [ ] **Step 3: Írd meg a `src/index.ts`-t**

```ts
import './env';
import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Ellenőrizd a típusokat**

Run: `npm run typecheck`
Expected: hibamentes lefutás.

- [ ] **Step 5: Indítsd a szervert és ellenőrizd a count végpontot**

Run (külön terminálban `npm start`, majd):
```bash
curl -s localhost:3000/customers/count
```
Expected: `{"count":15}`.

- [ ] **Step 6: Ellenőrizd a by-distance végpontot**

Run:
```bash
curl -s localhost:3000/customers/by-distance | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.map(c=>c.telepules+' '+c.distanceKm).join('\n'))"
```
Expected: Budapest `0` elöl, növekvő `distanceKm` sorrend (pl. Vienna ≈ 214.x), a lista végén nincs `null` (mind a 15 város ismert). Állítsd le a szervert (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git add src/routes/customers.ts src/app.ts src/index.ts
git commit -m "feat: add Fastify app with count and by-distance endpoints"
```

---

### Task 7: Postgres MCP bekötése

**Files:**
- Create: `.mcp.json`

**Interfaces:**
- Consumes: a Docker Postgres `DATABASE_URL`-je.
- Produces: read-only Postgres MCP szerver a fejlesztői séma-/adatvizsgálathoz (a felhasználó a következő munkamenetben engedélyezi).

- [ ] **Step 1: Hozd létre a `.mcp.json`-t**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://app:app@localhost:5433/customers"
      ]
    }
  }
}
```

Megjegyzés: a `@modelcontextprotocol/server-postgres` egy read-only referencia-szerver. Ha nem elérhető, alternatíva a `crystaldba/postgres-mcp` (Postgres MCP Pro), amely bővebb séma-inspekciót ad.

- [ ] **Step 2: Ellenőrizd, hogy érvényes JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "chore: wire read-only Postgres MCP for dev inspection"
```

---

### Task 8: README (magyar)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: minden korábbi task scriptjei/végpontjai.
- Produces: futtatási dokumentáció (Postgres indítás, migráció, seed, szerver, tesztek).

- [ ] **Step 1: Írd felül a `README.md`-t**

````markdown
# Ügyfél-távolság szolgáltatás

Kicsi, offline REST szolgáltatás Postgres fölött: betölti a seed ügyfeleket, lokálisan
geokódolja a településeiket, és Budapesttől mért távolság szerint rendezve szolgáltatja
őket. Futásidőben nincs külső API- vagy LLM-hívás.

## Technológia

Node.js 22 + TypeScript (ESM, `tsx`), Fastify, `pg` (nyers SQL), Prisma (csak séma +
migráció), Vitest, PostgreSQL (Docker Compose).

## Előfeltételek

- Node.js 22+
- Docker + Docker Compose

## Beállítás és futtatás

1. Függőségek telepítése:
   ```bash
   npm install
   ```
2. Környezeti változók:
   ```bash
   cp .env.example .env
   ```
3. Postgres indítása (Docker, a `5433` host-porton):
   ```bash
   npm run db:up
   ```
4. Migráció (séma létrehozása):
   ```bash
   npm run migrate
   ```
   > Fejlesztéskor új migráció generálásához: `npm run migrate:dev`.
5. Seed betöltése (idempotens — többször is futtatható):
   ```bash
   npm run seed
   ```
6. Szerver indítása:
   ```bash
   npm start        # vagy: npm run dev (watch módban)
   ```
   A szerver a `http://localhost:3000`-on figyel.

## Végpontok

- `GET /customers/count` → `{ "count": 15 }`
- `GET /customers/by-distance` → ügyféllista Budapesttől mért növekvő távolság szerint.
  Minden elem tartalmazza a `distanceKm` mezőt (1 tizedesre kerekítve). A budapesti
  ügyfelek elöl (`0`), az ismeretlen koordinátájúak a lista végén (`distanceKm: null`),
  holtverseny esetén `name` szerint.

Példa:
```bash
curl -s localhost:3000/customers/count
curl -s localhost:3000/customers/by-distance
```

## Tesztek

```bash
npm test
```
A unit tesztek a haversine távolságszámítást fedik le (Budapest–Bécs ismert táv, a 0 km-es
eset, és a null-koordináta kezelése). A tesztek nem igényelnek adatbázist.

## Adatmodell

`customers`: `id, name, telepules, lat (nullable), lon (nullable), budget (nullable),
note (nullable)`. Idempotencia-kulcs: `(name, telepules)`.

## Geokódolás

A település → koordináta megfeleltetés a repóba bundle-olt
`src/geo/city-coordinates.json`-ból történik (a seedben előforduló városokra). A párosítás
ékezet- és kis/nagybetű-független, trimmelt; a `Budapest` (és kerületei) a fővárosra esik.
Ismeretlen település esetén `lat/lon = null` (ez nem hiba, naplózódik).

## Fejlesztői séma-/adatvizsgálat (Postgres MCP)

A repó `.mcp.json`-ja bekötve tartalmaz egy read-only Postgres MCP szervert, amellyel a
séma és az adat közvetlenül vizsgálható. A Claude Code a következő munkamenet indulásakor
kéri az engedélyezését.

## Leállítás

```bash
npm run db:down
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Hungarian README with run instructions"
```

---

## Önellenőrzés (a terv írója töltötte ki)

**1. Spec lefedettség:**
- Adatmodell → Task 2 ✅
- Offline geokódoló referencia + robusztus (ékezet/kis-nagybetű/whitespace) párosítás + Budapest-szabály + null-eset → Task 4 ✅
- Idempotens seed → Task 5 ✅
- `GET /customers/count` → Task 6 ✅
- `GET /customers/by-distance` (kerekítés, budapestiek elöl, null a végén, name holtverseny) → Task 6 ✅
- Haversine unit tesztek (ismert táv, 0 km, null) → Task 3 ✅
- README (indítás, migráció, seed, szerver, tesztek) → Task 8 ✅
- Postgres MCP bekötés → Task 7 ✅
- Kis, fókuszált commitok → minden task egy commit ✅

**2. Placeholder-ellenőrzés:** nincs TBD/TODO; minden lépés konkrét kódot/parancsot tartalmaz. ✅

**3. Típus-konzisztencia:** `Coord`, `haversineKm`, `distanceFromBudapestKm`, `normalize`, `geocode`, `pool`, `buildApp`, `customerRoutes` nevei és szignatúrái végig egyeznek a taskok között. ✅
