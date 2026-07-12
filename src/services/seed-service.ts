import { readFile } from 'node:fs/promises';
import { lookupTown } from '../lib/geo-reference';
import {
  upsertCustomer,
  countCustomers,
  type UpsertCustomerInput,
} from '../data/customers-repo';
import type { SeedRecord } from '../types';

/** A leképezett sor: a perzisztálható adat + az egyeztetés eredménye. */
export interface MappedRow extends UpsertCustomerInput {
  matched: boolean;
}

/** Egy egyszerű logger interfész (a console is megfelel). */
export interface SeedLogger {
  warn: (msg: string) => void;
  info?: (msg: string) => void;
}

/** A seed-futás összegzése. */
export interface SeedResult {
  total: number;
  matched: number;
  unmatched: number;
}

/**
 * Egy nyers seed-rekordot leképez a customers sor alakjára, a település
 * geokódolásával (AD-3). PURE: nincs IO, közvetlenül tesztelhető.
 * Ismeretlen település esetén lat/lon = null, és `matched: false` (nem hiba).
 */
export function mapRecordToRow(record: SeedRecord): MappedRow {
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
 */
export async function seedCustomers({
  seedPath,
  logger = console,
}: {
  seedPath: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const raw = await readFile(seedPath, 'utf8');
  const records = JSON.parse(raw) as SeedRecord[];

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
