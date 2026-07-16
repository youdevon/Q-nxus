import "dotenv/config";

import { notifyVacationForfeitureReminders } from "../src/modules/hr/services/notify-vacation-forfeiture";

async function main() {
  const result = await notifyVacationForfeitureReminders();

  console.log(
    JSON.stringify(
      {
        ...result,
        note:
          result.considered === 0
            ? "No current contracts with available VAC ending within 30 days."
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
