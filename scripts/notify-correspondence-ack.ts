import "dotenv/config";

import { notifyCorrespondenceAcknowledgementReminders } from "../src/modules/hr/services/notify-correspondence-acknowledgement";

async function main() {
  const result = await notifyCorrespondenceAcknowledgementReminders();

  console.log(
    JSON.stringify(
      {
        ...result,
        note:
          result.considered === 0
            ? "No issued letters awaiting acknowledgement."
            : undefined,
      },
      null,
      2,
    ),
  );
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
