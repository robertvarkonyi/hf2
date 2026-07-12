/**
 * Pure, null-biztos haversine távolságszámítás (AD-6).
 * Nincs IO/DB-függés → közvetlenül unit-tesztelhető.
 */

const EARTH_RADIUS_KM = 6371;

/** Fok -> radián. */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Igaz, ha a pont használható koordináta ({lat, lon} véges számokkal).
 * @param {{lat:number, lon:number}|null|undefined} p
 */
function hasCoords(p) {
  return (
    p != null &&
    typeof p.lat === 'number' &&
    typeof p.lon === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon)
  );
}

/**
 * Két pont gömbi (haversine) távolsága kilométerben.
 * Ha bármelyik koordináta hiányzik/érvénytelen, null-t ad vissza (nem dob).
 *
 * @param {{lat:number, lon:number}|null|undefined} a
 * @param {{lat:number, lon:number}|null|undefined} b
 * @returns {number|null} távolság km-ben, vagy null
 */
export function haversineKm(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
