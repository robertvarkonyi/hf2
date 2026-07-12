import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import { customersRoutes } from './routes/customers';

/**
 * Összeállítja a Fastify alkalmazást (plugin-regisztráció).
 * A szerver indítása a server.ts-ben történik, hogy az app tesztelhető maradjon.
 */
export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...opts });

  // Egyszerű életjel-végpont.
  app.get('/health', async () => ({ status: 'ok' }));

  // Ügyfél-végpontok (routes réteg).
  app.register(customersRoutes);

  return app;
}
