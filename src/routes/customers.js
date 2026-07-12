import { getCount, getByDistance } from '../services/customers-service.js';

/**
 * Ügyfél-végpontok Fastify plugin (routes réteg, AD-1).
 *
 * @param {import('fastify').FastifyInstance} app
 */
export async function customersRoutes(app) {
  // FR-5: az ügyfelek tényleges darabszáma.
  app.get('/customers/count', async () => {
    const count = await getCount();
    return { count };
  });

  // FR-6: ügyfelek növekvő távolság szerint Budapesthez (Budapest 0.0 elöl,
  // ismeretlen koordináta a végén distanceKm:null-lal, holtverseny name szerint).
  app.get('/customers/by-distance', async () => {
    return getByDistance();
  });
}
