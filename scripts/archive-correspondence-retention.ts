import "dotenv/config";

import { archiveExpiredCorrespondenceRetention } from "../src/modules/hr/services/archive-correspondence-retention";

async function main() {
  const result = await archiveExpiredCorrespondenceRetention();

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
