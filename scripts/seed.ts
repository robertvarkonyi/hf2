import path from 'node:path';
import { seedCustomers } from '../src/services/seed-service';
import { prisma } from '../src/data/prisma';

/**
 * Idempotens seed runner. Kétszer is futtatható duplázás nélkül (FR-1).
 * Használat: `npm run seed` (a repo gyökeréből).
 */
const seedPath = path.resolve(process.cwd(), 'seed/seed-customers.json');

try {
  const { total, matched, unmatched } = await seedCustomers({ seedPath });
  console.log(
    `Seed kész: összesen ${total} ügyfél az adatbázisban ` +
      `(geokódolt: ${matched}, ismeretlen település: ${unmatched}).`,
  );
} catch (err) {
  console.error('Seed hiba:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
