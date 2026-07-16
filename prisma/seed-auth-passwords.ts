import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import {
  PrismaClient,
  UserAccountStatus,
} from "../generated/prisma/client"
import { hashPassword } from "../src/modules/auth/lib/password"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Add it to the project .env file.",
  )
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error", "warn"],
})

const DEFAULT_PASSWORD = "ChangeMe123!"

function emailForEmployee(employee: {
  workEmail: string | null
  employeeNumber: string
  firstName: string
  lastName: string
}): string {
  if (employee.workEmail?.trim()) {
    return employee.workEmail.trim().toLowerCase()
  }

  const slug = `${employee.firstName}.${employee.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")

  return `${slug || employee.employeeNumber.toLowerCase()}@q-nxus.local`
}

async function main() {
  const passwordHash = hashPassword(DEFAULT_PASSWORD)

  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  if (!organization) {
    throw new Error("No organization found.")
  }

  const admin = await prisma.user.update({
    where: {
      email: "admin@q-nxus.local",
    },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      status: UserAccountStatus.ACTIVE,
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
    },
  })

  console.log(
    `Updated password for ${admin.email} (${admin.firstName} ${admin.lastName})`,
  )

  if (!admin.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: {
        isArchived: false,
      },
      orderBy: {
        employeeNumber: "asc",
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
    })

    if (employee) {
      await prisma.user.update({
        where: {
          email: admin.email,
        },
        data: {
          employeeId: employee.id,
        },
      })

      console.log(
        `Linked admin to employee ${employee.employeeNumber} (${employee.firstName} ${employee.lastName})`,
      )
    }
  }

  const employeesWithoutUsers = await prisma.employee.findMany({
    where: {
      isArchived: false,
      user: null,
      OR: [
        {
          positionId: {
            not: null,
          },
        },
        {
          assignments: {
            some: {
              isCurrent: true,
              positionId: {
                not: null,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      position: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      employeeNumber: "asc",
    },
  })

  for (const employee of employeesWithoutUsers) {
    const email = emailForEmployee(employee)

    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        employeeId: true,
      },
    })

    if (existingEmail && !existingEmail.employeeId) {
      await prisma.user.update({
        where: {
          id: existingEmail.id,
        },
        data: {
          employeeId: employee.id,
          passwordHash,
          isActive: true,
          status: UserAccountStatus.ACTIVE,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      })

      console.log(
        `Linked existing user ${email} to ${employee.employeeNumber} (${employee.firstName} ${employee.lastName})`,
      )
      continue
    }

    if (existingEmail) {
      console.log(
        `Skipped ${employee.employeeNumber}: email ${email} already linked elsewhere.`,
      )
      continue
    }

    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        passwordHash,
        status: UserAccountStatus.ACTIVE,
        isActive: true,
        emailVerifiedAt: new Date(),
        employeeId: employee.id,
      },
    })

    console.log(
      `Created user ${email} for ${employee.employeeNumber} (${employee.firstName} ${employee.lastName})${employee.position ? ` · ${employee.position.title}` : ""}`,
    )
  }

  console.log(`Default password for seeded users: ${DEFAULT_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
