import { describe, it, expect } from 'vitest';
import { rankByDistance } from '../src/lib/rank.js';
import { GEO_REFERENCE, BUDAPEST } from '../src/lib/geo-reference.js';
import { normalizeTown } from '../src/lib/normalize.js';

const vienna = GEO_REFERENCE[normalizeTown('Vienna')];
const stockholm = GEO_REFERENCE[normalizeTown('Stockholm')];

// Szintetikus ügyfelek a rendezési szabály (AD-5) ellenőrzéséhez.
const customers = [
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
    expect(ranked[0].distanceKm).toBe(0);
    expect(ranked[1].distanceKm).toBe(0);
    // A két budapesti holtversenyben name szerint (Budapesti A < Budapesti B).
    expect(ranked[0].name).toBe('Budapesti A');
    expect(ranked[1].name).toBe('Budapesti B');
  });

  it('a távolságok növekvő sorrendben követik egymást (a null-ok kivételével)', () => {
    const known = ranked.filter((r) => r.distanceKm != null).map((r) => r.distanceKm);
    const sorted = [...known].sort((a, b) => a - b);
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

  it('minden elem a teljes rekordot adja vissza', () => {
    for (const r of ranked) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('telepules');
      expect(r).toHaveProperty('budget');
      expect(r).toHaveProperty('note');
      expect(r).toHaveProperty('distanceKm');
    }
  });
});
