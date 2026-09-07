import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl, MISSING_DATABASE_URL_MESSAGE } from "@/lib/database-url";

/**
 * The Prisma client, created lazily on first use.
 *
 * Construction is deferred deliberately: `next build` imports every route's module graph to
 * collect its configuration, and a build machine has no database. Connecting at import time
 * makes the build fail wherever `DATABASE_URL` is absent (Railway injects it at runtime, not
 * during the build). Deferring means a missing URL is reported when a request actually needs
 * the database, which is the only moment it matters.
 */
const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(MISSING_DATABASE_URL_MESSAGE);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prismaClient;
  if (existing) return existing;

  // Cached on globalThis so hot reloads in development reuse one connection pool.
  const client = createClient();
  globalForPrisma.prismaClient = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});
