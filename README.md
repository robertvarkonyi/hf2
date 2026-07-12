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
   > A `DATABASE_URL` a `prisma.config.ts`-en keresztül jut el a Prisma CLI-hez (amely betölti a `.env`-et), ezért nem kell külön exportálni.
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
