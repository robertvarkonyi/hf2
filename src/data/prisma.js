import { PrismaClient } from '@prisma/client';

/**
 * Megosztott PrismaClient singleton — a data réteg az egyetlen DB-elérési pont (AD-1).
 */
export const prisma = new PrismaClient();
