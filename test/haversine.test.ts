import { describe, it, expect } from 'vitest';
import { haversineKm, distanceFromBudapestKm, BUDAPEST } from '../src/geo/haversine';

describe('haversineKm', () => {
  it('Budapest → Bécs ≈ 214 km', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const d = haversineKm(BUDAPEST, vienna);
    expect(d).toBeGreaterThan(209);
    expect(d).toBeLessThan(219);
  });

  it('Budapest → Budapest = 0 km', () => {
    expect(haversineKm(BUDAPEST, BUDAPEST)).toBe(0);
  });
});

describe('distanceFromBudapestKm', () => {
  it('null, ha a lat hiányzik', () => {
    expect(distanceFromBudapestKm({ lat: null, lon: 19.0402 })).toBeNull();
  });

  it('null, ha a lon hiányzik', () => {
    expect(distanceFromBudapestKm({ lat: 47.4979, lon: null })).toBeNull();
  });

  it('0 a budapesti koordinátára', () => {
    expect(distanceFromBudapestKm(BUDAPEST)).toBe(0);
  });
});
