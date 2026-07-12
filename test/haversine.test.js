import { describe, it, expect } from 'vitest';
import { haversineKm } from '../src/lib/haversine.js';
import { BUDAPEST, GEO_REFERENCE } from '../src/lib/geo-reference.js';
import { normalizeTown } from '../src/lib/normalize.js';

const VIENNA = GEO_REFERENCE[normalizeTown('Vienna')];

describe('haversineKm', () => {
  it('ismert táv: Budapest–Bécs ≈ 214 km', () => {
    const d = haversineKm(BUDAPEST, VIENNA);
    expect(d).not.toBeNull();
    // Nagykörös tűrés a kerekítéshez: 214 ± 3 km.
    expect(d).toBeGreaterThan(211);
    expect(d).toBeLessThan(217);
  });

  it('0 km eset: Budapest–Budapest = 0', () => {
    expect(haversineKm(BUDAPEST, BUDAPEST)).toBe(0);
  });

  it('szimmetrikus (a->b == b->a)', () => {
    expect(haversineKm(BUDAPEST, VIENNA)).toBeCloseTo(
      haversineKm(VIENNA, BUDAPEST),
      9,
    );
  });

  it('null-koordináta kezelése: null-t ad, nem dob', () => {
    expect(haversineKm(BUDAPEST, null)).toBeNull();
    expect(haversineKm(null, VIENNA)).toBeNull();
    expect(haversineKm(BUDAPEST, { lat: null, lon: null })).toBeNull();
    expect(haversineKm(BUDAPEST, { lat: 47.5, lon: undefined })).toBeNull();
    expect(haversineKm(undefined, undefined)).toBeNull();
  });
});
