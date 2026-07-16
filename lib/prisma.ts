import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Add it to the project .env file.",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

function createPrismaClient() {
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/**
 * After `prisma generate` adds models, Next.js HMR can keep a stale
 * PrismaClient on globalThis that is missing new delegates (e.g.
 * organizationHoliday). Recreate when required accessors are absent.
 */
function hasExpectedDelegates(client: PrismaClient): boolean {
  return (
    typeof client.organization !== "undefined" &&
    typeof client.organizationHoliday !== "undefined"
  );
}

const cached = globalForPrisma.prisma;
export const prisma =
  cached && hasExpectedDelegates(cached)
    ? cached
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
