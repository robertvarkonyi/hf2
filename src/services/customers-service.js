import { countCustomers, findAllCustomers } from '../data/customers-repo.js';
import { haversineKm } from '../lib/haversine.js';
import { BUDAPEST } from '../lib/geo-reference.js';

/**
 * Ügyfél-lekérdezések üzleti logikája (services réteg, AD-1).
 */

/**
 * @returns {Promise<number>} az ügyfelek tényleges darabszáma
 */
export function getCount() {
  return countCustomers();
}
