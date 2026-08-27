import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client. Next.js dev mode re-imports modules on every
 * hot reload, so without the global cache you leak connections until Postgres
 * refuses new ones. Import this everywhere — never `new PrismaClient()`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
