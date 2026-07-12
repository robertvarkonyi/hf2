import { countCustomers, findAllCustomers } from '../data/customers-repo';
import { rankByDistance } from '../lib/rank';
import type { RankedCustomer } from '../types';

/**
 * Ügyfél-lekérdezések üzleti logikája (services réteg, AD-1).
 * A DB-elérést köti össze a pure rangsorolással (src/lib/rank.ts).
 */

/** Az ügyfelek tényleges darabszáma. */
export function getCount(): Promise<number> {
  return countCustomers();
}

/** Ügyfelek növekvő távolság szerint Budapesthez. */
export async function getByDistance(): Promise<RankedCustomer[]> {
  const customers = await findAllCustomers();
  return rankByDistance(customers);
}
