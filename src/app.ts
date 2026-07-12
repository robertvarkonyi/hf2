import Fastify, { type FastifyInstance } from 'fastify';
import { customerRoutes } from './routes/customers';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.register(customerRoutes);
  return app;
}
