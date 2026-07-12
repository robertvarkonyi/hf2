/**
 * Ügyfél-végpontok Fastify plugin.
 * A konkrét végpontok (count, by-distance) a következő story-kban kerülnek ide.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export async function customersRoutes(app) {
  // A /customers/count és /customers/by-distance a Story 1.6 / 1.7 során kerül ide.
  void app;
}
