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
