import { describe, it, expect } from 'vitest';
import { rankByDistance, roundKm } from '../src/lib/rank';
import { GEO_REFERENCE, BUDAPEST } from '../src/lib/geo-reference';
import { normalizeTown } from '../src/lib/normalize';
import type { CustomerRecord } from '../src/types';

const vienna = GEO_REFERENCE[normalizeTown('Vienna')]!;
const stockholm = GEO_REFERENCE[normalizeTown('Stockholm')]!;

// Szintetikus ügyfelek a rendezési szabály (AD-5) ellenőrzéséhez.
const customers: CustomerRecord[] = [
  { id: 1, name: 'Stockholmi Ügyfél', telepules: 'Stockholm', ...stockholm, budget: 1, note: 'a' },
  { id: 2, name: 'Bécsi Ügyfél', telepules: 'Vienna', ...vienna, budget: 2, note: 'b' },
  { id: 3, name: 'Budapesti B', telepules: 'Budapest', ...BUDAPEST, budget: 3, note: 'c' },
  { id: 4, name: 'Budapesti A', telepules: 'Budapest', ...BUDAPEST, budget: 4, note: 'd' },
  { id: 5, name: 'Ismeretlen Z', telepules: 'Atlantisz', lat: null, lon: null, budget: 5, note: 'e' },
  { id: 6, name: 'Ismeretlen A', telepules: 'Atlantisz', lat: null, lon: null, budget: 6, note: 'f' },
];

describe('rankByDistance (FR6, AD-5)', () => {
  const ranked = rankByDistance(customers);

  it('növekvő távolság szerint rendez, a budapestiek elöl 0 távolsággal', () => {
    expect(ranked[0]!.distanceKm).toBe(0);
    expect(ranked[1]!.distanceKm).toBe(0);
    // A két budapesti holtversenyben name szerint (Budapesti A < Budapesti B).
    expect(ranked[0]!.name).toBe('Budapesti A');
    expect(ranked[1]!.name).toBe('Budapesti B');
  });

  it('a távolságok növekvő sorrendben követik egymást (a null-ok kivételével)', () => {
    const known = ranked.filter((r) => r.distanceKm != null).map((r) => r.distanceKm);
    const sorted = [...known].sort((a, b) => (a as number) - (b as number));
    expect(known).toEqual(sorted);
    // Bécs közelebb van, mint Stockholm.
    expect(ranked.map((r) => r.telepules).slice(0, 4)).toEqual([
      'Budapest', 'Budapest', 'Vienna', 'Stockholm',
    ]);
  });

  it('az ismeretlen koordinátájúak a lista végén, distanceKm: null, name szerint', () => {
    const tail = ranked.slice(-2);
    expect(tail.every((r) => r.distanceKm === null)).toBe(true);
    expect(tail.map((r) => r.name)).toEqual(['Ismeretlen A', 'Ismeretlen Z']);
  });

  it('distanceKm 1 tizedesre kerekített', () => {
    for (const r of ranked) {
      if (r.distanceKm != null) {
        expect(Number.isFinite(r.distanceKm)).toBe(true);
        expect(Math.round(r.distanceKm * 10) / 10).toBe(r.distanceKm);
      }
    }
  });

  it('minden elem a teljes rekordot adja vissza (nyers távot nem szivárogtat)', () => {
    for (const r of ranked) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('telepules');
      expect(r).toHaveProperty('budget');
      expect(r).toHaveProperty('note');
      expect(r).toHaveProperty('distanceKm');
      expect(r).not.toHaveProperty('distance'); // a belső nyers táv nem kerül a válaszba
    }
  });
});

describe('roundKm (fél-felfelé, float-biztos)', () => {
  it('a .x5 határértéket felfelé kerekíti (bináris float ellenére)', () => {
    expect(roundKm(2.35)).toBe(2.4);
    expect(roundKm(2.45)).toBe(2.5);
    expect(roundKm(2.85)).toBe(2.9);
  });

  it('null-ra null', () => {
    expect(roundKm(null)).toBeNull();
  });
});

describe('rankByDistance – determinizmus és nyers-táv rendezés', () => {
  it('a valódi (nyers) táv szerint rendez, nem a kerekített szerint', () => {
    const origin = { lat: 0, lon: 0 };
    const customers: CustomerRecord[] = [
      { id: 1, name: 'Alma', telepules: 'A', lat: 0.0453, lon: 0, budget: null, note: null }, // ~5.04 km
      { id: 2, name: 'Zebra', telepules: 'Z', lat: 0.0446, lon: 0, budget: null, note: null }, // ~4.96 km
    ];
    const ranked = rankByDistance(customers, origin);
    // Mindkettő 5.0-ra kerekül, de Zebra van közelebb → Zebra elöl, a név ellenére.
    expect(ranked.map((r) => r.distanceKm)).toEqual([5, 5]);
    expect(ranked.map((r) => r.name)).toEqual(['Zebra', 'Alma']);
  });

  it('holtversenyt determinisztikus, kódpont-alapú név-sorrenddel dönt (nem locale)', () => {
    const origin = { lat: 0, lon: 0 };
    const customers: CustomerRecord[] = [
      { id: 1, name: 'Ábel', telepules: 'X', lat: 1, lon: 1, budget: null, note: null },
      { id: 2, name: 'Zeta', telepules: 'X', lat: 1, lon: 1, budget: null, note: null },
    ];
    const ranked = rankByDistance(customers, origin);
    // Azonos koordináta → azonos táv. Kódpont szerint 'Zeta' (Z=U+005A) < 'Ábel' (Á=U+00C1).
    // (A 'hu' locale fordítva adná – ezt szándékosan kerüljük a determinizmusért.)
    expect(ranked.map((r) => r.name)).toEqual(['Zeta', 'Ábel']);
  });
});
