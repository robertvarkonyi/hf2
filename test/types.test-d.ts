import { describe, it, expectTypeOf, assertType } from 'vitest';
import { normalizeTown } from '../src/lib/normalize';
import { haversineKm } from '../src/lib/haversine';
import { lookupTown } from '../src/lib/geo-reference';
import { rankByDistance, roundKm } from '../src/lib/rank';
import { getByDistance, getCount } from '../src/services/customers-service';
import type { Coord, CustomerRecord, RankedCustomer } from '../src/types';
import type { Customer } from '@prisma/client';

describe('típus-szerződések', () => {
  it('normalizeTown: (string|null|undefined) => string', () => {
    expectTypeOf(normalizeTown).parameters.toEqualTypeOf<
      [string | null | undefined]
    >();
    expectTypeOf(normalizeTown).returns.toEqualTypeOf<string>();
  });

  it('haversineKm: number | null a visszatérés', () => {
    expectTypeOf(haversineKm).returns.toEqualTypeOf<number | null>();
  });

  it('lookupTown: Coord | null a visszatérés', () => {
    expectTypeOf(lookupTown).returns.toEqualTypeOf<Coord | null>();
  });

  it('roundKm: number | null a visszatérés', () => {
    expectTypeOf(roundKm).returns.toEqualTypeOf<number | null>();
  });

  it('rankByDistance: RankedCustomer[] a visszatérés', () => {
    expectTypeOf(rankByDistance).returns.toEqualTypeOf<RankedCustomer[]>();
  });

  it('getCount: Promise<number>, getByDistance: Promise<RankedCustomer[]>', () => {
    expectTypeOf(getCount).returns.resolves.toEqualTypeOf<number>();
    expectTypeOf(getByDistance).returns.resolves.toEqualTypeOf<RankedCustomer[]>();
  });

  it('RankedCustomer: distanceKm/id megvan, lat/lon/distance nincs', () => {
    expectTypeOf<RankedCustomer>().toHaveProperty('id');
    expectTypeOf<RankedCustomer>().toHaveProperty('distanceKm');
    expectTypeOf<RankedCustomer>().not.toHaveProperty('lat');
    expectTypeOf<RankedCustomer>().not.toHaveProperty('lon');
    expectTypeOf<RankedCustomer>().not.toHaveProperty('distance');
  });

  it('distanceKm típusa number | null', () => {
    expectTypeOf<RankedCustomer['distanceKm']>().toEqualTypeOf<number | null>();
  });

  it('drift-őr: CustomerRecord szinkronban a Prisma Customer modellel', () => {
    expectTypeOf<CustomerRecord>().toEqualTypeOf<Customer>();
  });

  it('a Prisma Customer[] érvényes bemenet a rankByDistance-nek', () => {
    const rows: Customer[] = [];
    assertType<RankedCustomer[]>(rankByDistance(rows));
  });
});
