import { describe, it, expect } from 'vitest';
import { normalize } from '../src/geo/normalize';
import { geocode } from '../src/geo/geocode';

describe('normalize', () => {
  it('ékezet-, kis/nagybetű- és whitespace-független', () => {
    expect(normalize('  Kraków ')).toBe('krakow');
    expect(normalize('KRAKOW')).toBe('krakow');
    expect(normalize('Budapest')).toBe('budapest');
  });

  it('a belső whitespace-t egyetlen szóközzé vonja össze', () => {
    expect(normalize('New   York')).toBe('new york');
  });
});

describe('geocode', () => {
  it('ismert városra koordinátát ad (ékezettel is)', () => {
    const r = geocode('Kraków');
    expect(r.lat).toBeCloseTo(50.0647, 3);
    expect(r.lon).toBeCloseTo(19.945, 3);
  });

  it('Budapest kerülete is a fővárosra esik', () => {
    const r = geocode('Budapest XI.');
    expect(r.lat).toBeCloseTo(47.4979, 3);
    expect(r.lon).toBeCloseTo(19.0402, 3);
  });

  it('ismeretlen település esetén null koordináta', () => {
    expect(geocode('Atlantisz')).toEqual({ lat: null, lon: null });
  });
});
