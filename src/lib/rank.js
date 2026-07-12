import { haversineKm } from './haversine.js';
import { BUDAPEST } from './geo-reference.js';

/**
 * Pure távolság-rangsorolás (AD-5, AD-6). Nincs IO/DB-függés → közvetlenül
 * unit-tesztelhető, és csak a lib rétegre támaszkodik (AD-1).
 */

/** distanceKm 1 tizedesre kerekítve, vagy null (AD-5). */
export function roundKm(km) {
  return km == null ? null : Math.round(km * 10) / 10;
}

/**
 * Rendezési szabály (AD-5):
 *  1) ismert distanceKm növekvő,
 *  2) ismeretlen (null) a lista végén,
 *  3) holtverseny esetén — a null-blokkon belül is — name növekvő.
 */
function compareByDistance(a, b) {
  const aNull = a.distanceKm == null;
  const bNull = b.distanceKm == null;
  if (aNull && bNull) return a.name.localeCompare(b.name);
  if (aNull) return 1;
  if (bNull) return -1;
  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  return a.name.localeCompare(b.name);
}

/**
 * PURE: ügyfélsorokból távolság-rangsorolt lista Budapesthez képest (AD-5).
 * Minden elem a teljes rekordot adja + distanceKm (1 tizedes vagy null).
 *
 * @param {Array<{id:number,name:string,telepules:string,lat:number|null,lon:number|null,budget:number|null,note:string|null}>} customers
 * @param {{lat:number, lon:number}} [origin]
 * @returns {Array<object>}
 */
export function rankByDistance(customers, origin = BUDAPEST) {
  const ranked = customers.map((c) => ({
    id: c.id,
    name: c.name,
    telepules: c.telepules,
    budget: c.budget,
    note: c.note,
    distanceKm: roundKm(haversineKm(origin, { lat: c.lat, lon: c.lon })),
  }));
  ranked.sort(compareByDistance);
  return ranked;
}
