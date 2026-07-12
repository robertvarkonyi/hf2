import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // .env is optional; fall back to the existing process.env (e.g. CI-injected vars).
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
