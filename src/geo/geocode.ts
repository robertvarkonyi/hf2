import coordinates from './city-coordinates.json';
import { normalize } from './normalize';

interface Coord {
  lat: number;
  lon: number;
}

const table = coordinates as Record<string, Coord>;

export function geocode(city: string): { lat: number | null; lon: number | null } {
  const key = normalize(city);

  // Budapest-szabály: a kerületek (pl. "Budapest XI.") is a fővárosra esnek.
  if (key.startsWith('budapest')) {
    return { ...table.budapest };
  }

  const hit = table[key];
  if (hit) {
    return { lat: hit.lat, lon: hit.lon };
  }

  return { lat: null, lon: null };
}
