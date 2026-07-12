/**
 * Megosztott domain típusok.
 */

/** Földrajzi koordináta (érvényes lat/lon). */
export interface Coord {
  lat: number;
  lon: number;
}

/** Koordináta-bemenet, ahol a lat/lon hiányozhat vagy null lehet (validálás előtt). */
export interface CoordInput {
  lat?: number | null;
  lon?: number | null;
}

/**
 * Az ügyfél-rekord alakja (a DB/seed sor). Szándékosan a Prisma modelltől
 * függetlenül definiált; a type teszt őrzi, hogy szinkronban maradjon vele.
 */
export interface CustomerRecord {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

/** A by-distance válasz egy eleme: a teljes rekord lat/lon nélkül + distanceKm. */
export type RankedCustomer = Omit<CustomerRecord, 'lat' | 'lon'> & {
  distanceKm: number | null;
};

/** Egy nyers seed-rekord alakja (seed-customers.json elemei). */
export interface SeedRecord {
  name: string;
  budget?: number;
  note?: string;
  location?: {
    city?: string;
    countryCode?: string;
  };
}
