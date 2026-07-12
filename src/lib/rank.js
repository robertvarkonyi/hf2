import { haversineKm } from './haversine.js';
import { BUDAPEST } from './geo-reference.js';

/**
 * Pure távolság-rangsorolás (AD-5, AD-6). Nincs IO/DB-függés → közvetlenül
 * unit-tesztelhető, és csak a lib rétegre támaszkodik (AD-1).
 */

/**
 * distanceKm 1 tizedesre kerekítve (fél-felfelé), vagy null (AD-5).
 * A toPrecision kiküszöböli a bináris float ábrázolási hibát (pl. 2.35 a
 * memóriában 2.3499999996), ami különben tévesen lefelé kerekítene.
 */
export function roundKm(km) {
  if (km == null) return null;
  return Math.round(Number((km * 10).toPrecision(15))) / 10;
}

/**
 * Determinisztikus, környezet-független név-összehasonlító (kódpont szerint).
 * Szándékosan NEM localeCompare: az a futtatókörnyezet ICU/locale-jától függ,
 * így a holtverseny-rendezés gépenként eltérhetne (NFR4 sérülne).
 */
function compareByName(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Rendezési szabály (AD-5) a NYERS távon (nem a kerekített értéken, hogy két
 * azonos tizedesre kerekülő, de eltérő valós távolságú ügyfél a valódi táv
 * szerint dőljön el):
 *  1) ismert távolság növekvő,
 *  2) ismeretlen (null) a lista végén,
 *  3) holtverseny esetén — a null-blokkon belül is — name növekvő.
 */
function compareByDistance(a, b) {
  const aNull = a.distance == null;
  const bNull = b.distance == null;
  if (aNull && bNull) return compareByName(a.name, b.name);
  if (aNull) return 1;
  if (bNull) return -1;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return compareByName(a.name, b.name);
}

/**
 * PURE: ügyfélsorokból távolság-rangsorolt lista Budapesthez képest (AD-5).
 * Minden elem a teljes rekordot adja + distanceKm (1 tizedes vagy null).
 * A rendezés a nyers távon történik; a nyers érték nem szivárog a válaszba.
 *
 * @param {Array<{id:number,name:string,telepules:string,lat:number|null,lon:number|null,budget:number|null,note:string|null}>} customers
 * @param {{lat:number, lon:number}} [origin]
 * @returns {Array<object>}
 */
export function rankByDistance(customers, origin = BUDAPEST) {
  return customers
    .map((c) => {
      const distance = haversineKm(origin, { lat: c.lat, lon: c.lon });
      return {
        id: c.id,
        name: c.name,
        telepules: c.telepules,
        budget: c.budget,
        note: c.note,
        distance, // csak a rendezéshez, nyers km vagy null
        distanceKm: roundKm(distance),
      };
    })
    .sort(compareByDistance)
    .map(({ distance, ...out }) => out); // a nyers távot nem adjuk vissza
}
