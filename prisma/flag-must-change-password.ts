import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error", "warn"],
})

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      employeeId: {
        not: null,
      },
      email: {
        not: "admin@q-nxus.local",
      },
    },
    data: {
      mustChangePassword: true,
    },
  })

  console.log(
    `Flagged ${result.count} employee user(s) for password change.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
