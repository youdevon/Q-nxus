import "dotenv/config";

import { purgeArchivedPriorEmploymentYtd } from "../src/modules/payroll/services/purge-archived-prior-employment-ytd";

async function main() {
  const retentionRaw = process.env.PRIOR_EMPLOYMENT_ARCHIVE_RETENTION_DAYS;
  const retentionDays = retentionRaw ? Number(retentionRaw) : undefined;

  const result = await purgeArchivedPriorEmploymentYtd({
    retentionDays:
      retentionDays != null && Number.isFinite(retentionDays)
        ? retentionDays
        : undefined,
  });

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
