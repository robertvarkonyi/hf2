import { getCount } from '../services/customers-service.js';

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

  // A /customers/by-distance a Story 1.7 során kerül ide.
}
