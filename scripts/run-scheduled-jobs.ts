import "dotenv/config";

import { runScheduledJobsOnce } from "../src/modules/jobs/scheduled-jobs";

async function main() {
  const results = await runScheduledJobsOnce();
  const failed = results.filter((result) => !result.ok);

  console.log(JSON.stringify(results, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
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
