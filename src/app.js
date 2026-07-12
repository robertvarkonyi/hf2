import Fastify from 'fastify';
import { customersRoutes } from './routes/customers.js';

/**
 * Összeállítja a Fastify alkalmazást (plugin-regisztráció).
 * A szerver indítása a server.js-ben történik, hogy az app tesztelhető maradjon.
 *
 * @param {import('fastify').FastifyServerOptions} [opts]
 * @returns {import('fastify').FastifyInstance}
 */
export function buildApp(opts = {}) {
  const app = Fastify({ logger: true, ...opts });

  // Egyszerű életjel-végpont.
  app.get('/health', async () => ({ status: 'ok' }));

  // Ügyfél-végpontok (routes réteg).
  app.register(customersRoutes);

  return app;
}
