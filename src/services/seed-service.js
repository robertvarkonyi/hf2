import { readFile } from 'node:fs/promises';
import { lookupTown } from '../lib/geo-reference.js';
import { upsertCustomer, countCustomers } from '../data/customers-repo.js';

/**
 * Egy nyers seed-rekordot leképez a customers sor alakjára, a település
 * geokódolásával (AD-3). PURE: nincs IO, közvetlenül tesztelhető.
 *
 * Ismeretlen település esetén lat/lon = null, és `matched: false` (nem hiba).
 *
 * @param {{name:string, budget?:number, note?:string, location?:{city?:string}}} record
 * @returns {{name:string, telepules:string, lat:number|null, lon:number|null, budget:number|null, note:string|null, matched:boolean}}
 */
export function mapRecordToRow(record) {
  const telepules = record?.location?.city ?? '';
  const coord = lookupTown(telepules);
  return {
    name: record?.name ?? '',
    telepules,
    lat: coord?.lat ?? null,
    lon: coord?.lon ?? null,
    budget: record?.budget ?? null,
    note: record?.note ?? null,
    matched: coord != null,
  };
}

/**
 * Betölti a seed JSON-t, geokódolja és idempotensen felviszi (upsert) az ügyfeleket.
 * Ismeretlen település nem állítja le a folyamatot: null koordinátával megy tovább,
 * és WARN log készül (FR-4). Offline: semmilyen külső hívás (AD-3).
 *
 * @param {{seedPath:string, logger?:{warn:Function, info?:Function}}} opts
 * @returns {Promise<{total:number, matched:number, unmatched:number}>}
 */
export async function seedCustomers({ seedPath, logger = console }) {
  const raw = await readFile(seedPath, 'utf8');
  const records = JSON.parse(raw);

  let matched = 0;
  let unmatched = 0;

  for (const record of records) {
    const row = mapRecordToRow(record);
    if (row.matched) {
      matched += 1;
    } else {
      unmatched += 1;
      logger.warn(
        `Ismeretlen település a referenciában, lat/lon null marad: "${row.telepules}" (ügyfél: ${row.name})`,
      );
    }
    // A `matched` mezőt nem tároljuk — csak a sor adatait upsert-eljük.
    const { matched: _matched, ...persistable } = row;
    await upsertCustomer(persistable);
  }

  const total = await countCustomers();
  return { total, matched, unmatched };
}
