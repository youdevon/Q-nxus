import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaClientCtor: typeof PrismaClient | undefined;
  prismaSchemaCanary: string | undefined;
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

/**
 * Bump when generated models gain fields that older HMR-cached clients lack.
 * Identity statutory fields on Employee (nisNumber / birNumber / idType / idNumber).
 */
const PRISMA_SCHEMA_CANARY = [
  Prisma.EmployeeScalarFieldEnum.nisNumber,
  Prisma.EmployeeScalarFieldEnum.birNumber,
  Prisma.EmployeeScalarFieldEnum.idType,
  Prisma.EmployeeScalarFieldEnum.idNumber,
].join("|");

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
 * After `prisma generate` adds models or fields, Next.js HMR can keep a stale
 * PrismaClient on globalThis. Recreate when required accessors are absent,
 * the generated class was replaced, or the schema canary changed.
 */
function hasExpectedDelegates(client: PrismaClient): boolean {
  return (
    typeof client.organization !== "undefined" &&
    typeof client.organizationHoliday !== "undefined" &&
    typeof client.employeeFileChecklistItem !== "undefined" &&
    typeof client.employeeFileUpdateRequest !== "undefined"
  );
}

const cached = globalForPrisma.prisma;
const canReuseCachedClient =
  Boolean(cached) &&
  globalForPrisma.prismaClientCtor === PrismaClient &&
  globalForPrisma.prismaSchemaCanary === PRISMA_SCHEMA_CANARY &&
  hasExpectedDelegates(cached!);

export const prisma = canReuseCachedClient ? cached! : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClientCtor = PrismaClient;
  globalForPrisma.prismaSchemaCanary = PRISMA_SCHEMA_CANARY;
}
