import { normalizeTown } from './normalize';
import type { Coord } from '../types';

/**
 * Lokális, a repóba bundle-olt telepules -> {lat, lon} referencia (AD-3).
 * Csak a seedben ténylegesen előforduló városok, ismert koordinátákkal.
 * NINCS külső hívás. A referenciát szándékosan nem duzzasztjuk fel (SM-C1).
 *
 * A kulcsokat a lookup normalizálja (AD-2), így az ékezet/kis-nagybetű/whitespace
 * eltérések ugyanarra a városra esnek.
 */
const RAW_REFERENCE: Record<string, Coord> = {
  Budapest: { lat: 47.4979, lon: 19.0402 },
  Vienna: { lat: 48.2082, lon: 16.3738 },
  Munich: { lat: 48.1351, lon: 11.582 },
  Milan: { lat: 45.4642, lon: 9.19 },
  Barcelona: { lat: 41.3874, lon: 2.1686 },
  Lyon: { lat: 45.764, lon: 4.8357 },
  Kraków: { lat: 50.0647, lon: 19.945 },
  Prague: { lat: 50.0755, lon: 14.4378 },
  Lisbon: { lat: 38.7223, lon: -9.1393 },
  Amsterdam: { lat: 52.3676, lon: 4.9041 },
  Stockholm: { lat: 59.3293, lon: 18.0686 },
  Ljubljana: { lat: 46.0569, lon: 14.5058 },
  Bucharest: { lat: 44.4268, lon: 26.1025 },
  Dublin: { lat: 53.3498, lon: -6.2603 },
  Copenhagen: { lat: 55.6761, lon: 12.5683 },
};

const normalized: Record<string, Coord> = {};
for (const [city, coord] of Object.entries(RAW_REFERENCE)) {
  normalized[normalizeTown(city)] = coord;
}

/** Normalizált kulcsú, fagyasztott referencia. */
export const GEO_REFERENCE: Readonly<Record<string, Coord>> = Object.freeze(normalized);

/** A Budapest-referenciapont (a távolságot ehhez számoljuk) (AD-5). */
export const BUDAPEST: Coord = GEO_REFERENCE[normalizeTown('Budapest')] as Coord;

/**
 * Feloldja a település koordinátáját a referenciából.
 * @param city a nyers településnév (pl. seed location.city)
 * @returns a koordináta, vagy null, ha nincs a referenciában
 */
export function lookupTown(city: string | null | undefined): Coord | null {
  if (city == null) return null;
  return GEO_REFERENCE[normalizeTown(city)] ?? null;
}
