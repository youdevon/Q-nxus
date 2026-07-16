import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import {
  PrismaClient,
} from "../generated/prisma/client"
import { createContractLeaveBalances } from "../src/modules/hr/services/create-contract-leave-balances"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required.")
}

const adapter = new PrismaPg({
  connectionString,
})

const prisma = new PrismaClient({
  adapter,
})

async function main() {
  const contracts =
    await prisma.employmentContract.findMany({
      where: {
        isCurrent: true,
        endDate: {
          not: null,
        },
      },
      orderBy: {
        startDate: "asc",
      },
      select: {
        id: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        startDate: true,
        endDate: true,
      },
    })

  console.log(
    `Generating balances for ${contracts.length} current contract(s).`,
  )

  for (const contract of contracts) {
    const result =
      await createContractLeaveBalances(
        contract.id,
      )

    console.log(
      [
        `${contract.employee.firstName} ${contract.employee.lastName}`,
        `${contract.startDate.toISOString().slice(0, 10)}`,
        `${contract.endDate?.toISOString().slice(0, 10)}`,
        `created=${result.created}`,
        `updated=${result.updated}`,
      ].join(" | "),
    )
  }
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
