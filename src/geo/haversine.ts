export interface Coord {
  lat: number;
  lon: number;
}

export const BUDAPEST: Coord = { lat: 47.4979, lon: 19.0402 };

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function distanceFromBudapestKm(point: {
  lat: number | null;
  lon: number | null;
}): number | null {
  if (point.lat === null || point.lon === null) {
    return null;
  }
  return haversineKm(BUDAPEST, { lat: point.lat, lon: point.lon });
}
