import { describe, it, expect } from 'vitest';
import { mapRecordToRow } from '../src/services/seed-service.js';

describe('mapRecordToRow', () => {
  it('ismert településhez koordinátát rendel', () => {
    const row = mapRecordToRow({
      name: 'Anna Kovács',
      budget: 850,
      note: 'x',
      location: { city: 'Budapest', countryCode: 'HU' },
    });
    expect(row).toMatchObject({
      name: 'Anna Kovács',
      telepules: 'Budapest',
      lat: 47.4979,
      lon: 19.0402,
      budget: 850,
      note: 'x',
      matched: true,
    });
  });

  it('ékezetes/eltérő írásmódú települést is felold', () => {
    const row = mapRecordToRow({
      name: 'Katarzyna Nowak',
      location: { city: 'Kraków' },
    });
    expect(row.matched).toBe(true);
    expect(row.lat).toBe(50.0647);
  });

  it('ismeretlen településnél lat/lon null és matched=false (nem hiba)', () => {
    const row = mapRecordToRow({
      name: 'Ismeretlen Ügyfél',
      budget: 100,
      location: { city: 'Atlantisz' },
    });
    expect(row.telepules).toBe('Atlantisz');
    expect(row.lat).toBeNull();
    expect(row.lon).toBeNull();
    expect(row.matched).toBe(false);
    expect(row.budget).toBe(100);
  });

  it('hiányzó location esetén sem dob, üres telepules', () => {
    const row = mapRecordToRow({ name: 'X' });
    expect(row.telepules).toBe('');
    expect(row.lat).toBeNull();
    expect(row.matched).toBe(false);
  });
});
