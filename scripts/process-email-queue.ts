import "dotenv/config"

import {
  processEmailQueue,
  recoverStuckEmailDeliveries,
} from "../src/modules/notifications/services/process-email-queue"

async function main() {
  const recovered = await recoverStuckEmailDeliveries()
  const batchSize = Number(process.argv[2] ?? "50")
  const result = await processEmailQueue(
    Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 50,
  )

  console.log(
    JSON.stringify(
      {
        recovered,
        ...result,
        note:
          result.processed === 0 && result.skipped === 0
            ? "No pending mail, or SMTP_ENABLED is false. Set SMTP_* env vars and SMTP_ENABLED=true."
            : undefined,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma")
    await prisma.$disconnect()
  })
