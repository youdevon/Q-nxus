import "dotenv/config";

import { backfillEmployeeLoginEmails } from "../src/modules/auth/services/backfill-employee-login-emails";

async function main() {
  const result = await backfillEmployeeLoginEmails();

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
