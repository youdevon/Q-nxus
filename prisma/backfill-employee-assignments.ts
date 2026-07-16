import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({
  adapter,
})

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      departmentId: {
        not: null,
      },
      assignments: {
        none: {},
      },
    },
    select: {
      id: true,
      departmentId: true,
      positionId: true,
      hireDate: true,
    },
  })

  for (const employee of employees) {
    let jobDescriptionId: string | null = null

    if (employee.positionId) {
      const jobDescription =
        await prisma.positionJobDescription.findFirst({
          where: {
            positionId: employee.positionId,
            isCurrent: true,
            status: "ACTIVE",
          },
          orderBy: {
            versionNumber: "desc",
          },
          select: {
            id: true,
          },
        })

      jobDescriptionId = jobDescription?.id ?? null
    }

    await prisma.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        departmentId: employee.departmentId!,
        positionId: employee.positionId,
        jobDescriptionId,
        assignmentType: "INITIAL_APPOINTMENT",
        startDate: employee.hireDate,
        isCurrent: true,
        reason:
          "Initial assignment backfilled from the employee record.",
      },
    })
  }

  console.log(
    `Backfilled ${employees.length} employee assignment record(s).`,
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
