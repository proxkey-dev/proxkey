import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  var __proxkeyPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env["NODE_ENV"] === "production"
        ? ["error", "warn"]
        : ["error", "warn"],
  });
}

/**
 * Singleton Prisma client. Reuses a single connection pool per process,
 * including across hot-reloads in development.
 */
export const prisma: PrismaClient =
  globalThis.__proxkeyPrisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__proxkeyPrisma = prisma;
}

export type Db = PrismaClient;
