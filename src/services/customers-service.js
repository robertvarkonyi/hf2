import { countCustomers, findAllCustomers } from '../data/customers-repo.js';
import { rankByDistance } from '../lib/rank.js';

/**
 * Ügyfél-lekérdezések üzleti logikája (services réteg, AD-1).
 * A DB-elérést köti össze a pure rangsorolással (src/lib/rank.js).
 */

/**
 * @returns {Promise<number>} az ügyfelek tényleges darabszáma
 */
export function getCount() {
  return countCustomers();
}

/**
 * @returns {Promise<Array<object>>} ügyfelek növekvő távolság szerint Budapesthez
 */
export async function getByDistance() {
  const customers = await findAllCustomers();
  return rankByDistance(customers);
}
