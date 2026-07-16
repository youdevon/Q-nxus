import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client"
import { provisionEmployeeUser } from "../src/modules/auth/services/provision-employee-user"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error", "warn"],
})

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      user: null,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
    },
    orderBy: {
      employeeNumber: "asc",
    },
  })

  console.log(
    `Provisioning user accounts for ${employees.length} employees without users…`,
  )

  for (const employee of employees) {
    const result = await provisionEmployeeUser(employee.id)
    console.log(
      `${employee.employeeNumber} ${employee.firstName} ${employee.lastName} → ${result.created ? "created" : "linked"} ${result.email ?? result.userId}`,
    )
  }

  const linked = await prisma.user.findMany({
    where: {
      employeeId: {
        not: null,
      },
    },
    select: {
      id: true,
      employeeId: true,
    },
  })

  for (const user of linked) {
    if (user.employeeId) {
      const { syncEmployeeAccessRoles } = await import(
        "../src/modules/auth/services/provision-employee-user"
      )
      await syncEmployeeAccessRoles(user.id, user.employeeId)
    }
  }

  console.log(
    `Synchronized access roles for ${linked.length} linked users.`,
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
