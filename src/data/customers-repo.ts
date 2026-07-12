import { prisma } from './prisma';
import type { Customer } from '@prisma/client';

/**
 * Customer repository — az egyetlen DB-elérési pont az ügyfelekhez (AD-1).
 */

/** Az upsert bemenete (a customers sor a technikai id nélkül). */
export interface UpsertCustomerInput {
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

/**
 * Idempotens upsert a (name, telepules) természetes kulcson (AD-4).
 */
export function upsertCustomer(row: UpsertCustomerInput): Promise<Customer> {
  const { name, telepules, lat, lon, budget, note } = row;
  return prisma.customer.upsert({
    where: { name_telepules: { name, telepules } },
    update: { lat, lon, budget, note },
    create: { name, telepules, lat, lon, budget, note },
  });
}

/** Az ügyfelek tényleges sorszáma. */
export function countCustomers(): Promise<number> {
  return prisma.customer.count();
}

/** Az összes ügyfél. */
export function findAllCustomers(): Promise<Customer[]> {
  return prisma.customer.findMany();
}
