import { describe, it, expect } from 'vitest';
import { normalizeTown } from '../src/lib/normalize';
import { lookupTown, GEO_REFERENCE, BUDAPEST } from '../src/lib/geo-reference';

describe('normalizeTown', () => {
  it('kisbetűsít és trimmel', () => {
    expect(normalizeTown('  BUDAPEST ')).toBe('budapest');
    expect(normalizeTown('Budapest')).toBe('budapest');
  });

  it('eltávolítja az ékezeteket', () => {
    expect(normalizeTown('Kraków')).toBe('krakow');
    expect(normalizeTown('München')).toBe('munchen');
  });

  it('ugyanarra a kulcsra hozza a variánsokat', () => {
    expect(normalizeTown(' budapest ')).toBe(normalizeTown('Budapest'));
    expect(normalizeTown('Kraków')).toBe(normalizeTown('krakow'));
  });

  it('null/undefined bemenetre üres stringet ad (nem dob)', () => {
    expect(normalizeTown(null)).toBe('');
    expect(normalizeTown(undefined)).toBe('');
  });
});

describe('geo-reference', () => {
  it('mind a 15 seed-várost tartalmazza', () => {
    expect(Object.keys(GEO_REFERENCE)).toHaveLength(15);
  });

  it('feloldja a várost normalizált egyeztetéssel', () => {
    expect(lookupTown('Budapest')).toEqual({ lat: 47.4979, lon: 19.0402 });
    expect(lookupTown(' budapest ')).toEqual(BUDAPEST);
    // A seed Kraków-ja (ékezettel) is feloldódik.
    expect(lookupTown('Kraków')).toEqual({ lat: 50.0647, lon: 19.945 });
  });

  it('ismeretlen településre null-t ad (nem dob)', () => {
    expect(lookupTown('Atlantisz')).toBeNull();
    expect(lookupTown(null)).toBeNull();
    expect(lookupTown(undefined)).toBeNull();
  });
});
