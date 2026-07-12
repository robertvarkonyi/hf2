import { prisma } from './prisma.js';

/**
 * Customer repository — az egyetlen DB-elérési pont az ügyfelekhez (AD-1).
 */

/**
 * Idempotens upsert a (name, telepules) természetes kulcson (AD-4).
 * @param {{name:string, telepules:string, lat:number|null, lon:number|null, budget:number|null, note:string|null}} row
 */
export function upsertCustomer(row) {
  const { name, telepules, lat, lon, budget, note } = row;
  return prisma.customer.upsert({
    where: { name_telepules: { name, telepules } },
    update: { lat, lon, budget, note },
    create: { name, telepules, lat, lon, budget, note },
  });
}

/** @returns {Promise<number>} az ügyfelek tényleges sorszáma */
export function countCustomers() {
  return prisma.customer.count();
}

/** @returns {Promise<Array>} az összes ügyfél */
export function findAllCustomers() {
  return prisma.customer.findMany();
}
