import { haversineKm } from './haversine';
import { BUDAPEST } from './geo-reference';
import type { Coord, CustomerRecord, RankedCustomer } from '../types';

/**
 * Pure távolság-rangsorolás (AD-5, AD-6). Nincs IO/DB-függés → közvetlenül
 * unit-tesztelhető, és csak a lib rétegre támaszkodik (AD-1).
 */

/**
 * distanceKm 1 tizedesre kerekítve (fél-felfelé), vagy null (AD-5).
 * A toPrecision kiküszöböli a bináris float ábrázolási hibát (pl. 2.35 a
 * memóriában 2.3499999996), ami különben tévesen lefelé kerekítene.
 */
export function roundKm(km: number | null): number | null {
  if (km == null) return null;
  return Math.round(Number((km * 10).toPrecision(15))) / 10;
}

/**
 * Determinisztikus, környezet-független név-összehasonlító (kódpont szerint).
 * Szándékosan NEM localeCompare: az a futtatókörnyezet ICU/locale-jától függ,
 * így a holtverseny-rendezés gépenként eltérhetne (NFR4 sérülne).
 */
function compareByName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Belső sor a rendezéshez: a válasz-alak + a nyers távolság. */
interface RankingRow extends RankedCustomer {
  distance: number | null;
}

/**
 * Rendezési szabály (AD-5) a NYERS távon (nem a kerekített értéken, hogy két
 * azonos tizedesre kerekülő, de eltérő valós távolságú ügyfél a valódi táv
 * szerint dőljön el):
 *  1) ismert távolság növekvő,
 *  2) ismeretlen (null) a lista végén,
 *  3) holtverseny esetén — a null-blokkon belül is — name növekvő.
 */
function compareByDistance(a: RankingRow, b: RankingRow): number {
  // Közvetlen null-ellenőrzés, hogy a típusszűkítés a distance mezőre is hasson.
  if (a.distance == null && b.distance == null) return compareByName(a.name, b.name);
  if (a.distance == null) return 1;
  if (b.distance == null) return -1;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return compareByName(a.name, b.name);
}

/**
 * PURE: ügyfélsorokból távolság-rangsorolt lista Budapesthez képest (AD-5).
 * Minden elem a teljes rekordot adja + distanceKm (1 tizedes vagy null).
 * A rendezés a nyers távon történik; a nyers érték nem szivárog a válaszba.
 */
export function rankByDistance(
  customers: CustomerRecord[],
  origin: Coord = BUDAPEST,
): RankedCustomer[] {
  return customers
    .map((c): RankingRow => {
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
    .map(({ distance: _distance, ...out }): RankedCustomer => out);
}
