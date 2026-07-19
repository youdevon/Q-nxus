import "dotenv/config";

import { backfillCorrespondenceNotifications } from "../src/modules/hr/services/backfill-correspondence-notifications";

async function main() {
  const result = await backfillCorrespondenceNotifications();

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
