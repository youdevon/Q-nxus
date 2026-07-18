import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedBankExportProfiles } from "./seed-financial-institutions";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!org) {
    throw new Error("No organization found — run full seed first.");
  }
  await seedBankExportProfiles(prisma, org.id);
  const profiles = await prisma.bankExportProfile.findMany({
    where: { organizationId: org.id },
    select: { code: true, adapterKind: true, isPlaceholder: true },
  });
  console.log("Bank export profiles:", profiles);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
