import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client';
import { distanceFromBudapestKm } from '../geo/haversine';

interface CustomerRow {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customers/count', async () => {
    const result = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM customers',
    );
    return { count: result.rows[0].count };
  });

  app.get('/customers/by-distance', async () => {
    const result = await pool.query<CustomerRow>(
      'SELECT id, name, telepules, lat, lon, budget, note FROM customers',
    );

    const withDistance = result.rows.map((row) => {
      const distance = distanceFromBudapestKm(row);
      return {
        ...row,
        distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
      };
    });

    withDistance.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) {
        return a.name.localeCompare(b.name);
      }
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name);
    });

    return withDistance;
  });
}
