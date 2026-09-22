import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedBoardDepartmentAndPositions } from "./seed-departments";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Add it to the project .env file.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error", "warn"],
});

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    await seedBoardDepartmentAndPositions(prisma, org.id);
    console.log(`Seeded board structure for ${org.name ?? org.id}`);
  }

  const dept = await prisma.department.findFirst({
    where: { code: "BOARD" },
    include: {
      positions: {
        select: { title: true },
        orderBy: { title: "asc" },
      },
    },
  });

  console.log(JSON.stringify(dept, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
