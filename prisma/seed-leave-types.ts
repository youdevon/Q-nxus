import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import {
  LeaveAccrualMethod,
  PrismaClient,
} from "../generated/prisma/client"

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
  const organization =
    await prisma.organization.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    })

  if (!organization) {
    throw new Error(
      "Create an organization before seeding leave types.",
    )
  }

  const vacation = await prisma.leaveType.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "VAC",
      },
    },
    update: {
      name: "Vacation Leave",
      description:
        "Paid annual vacation leave available to eligible employees.",
      isPaid: true,
      requiresBalance: true,
      requiresDocument: false,
      minimumNoticeDays: 7,
      allowsHalfDay: true,
      carryForwardAllowed: true,
      carryForwardLimit: 10,
      sortOrder: 10,
      isSystem: true,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      code: "VAC",
      name: "Vacation Leave",
      description:
        "Paid annual vacation leave available to eligible employees.",
      isPaid: true,
      requiresBalance: true,
      requiresDocument: false,
      minimumNoticeDays: 7,
      allowsHalfDay: true,
      carryForwardAllowed: true,
      carryForwardLimit: 10,
      sortOrder: 10,
      isSystem: true,
    },
  })

  const sick = await prisma.leaveType.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "SICK",
      },
    },
    update: {
      name: "Sick Leave",
      description:
        "Leave used when an employee is unable to work because of illness or injury.",
      isPaid: true,
      requiresBalance: true,
      requiresDocument: true,
      documentRequiredAfter: 2,
      minimumNoticeDays: 0,
      allowsHalfDay: true,
      carryForwardAllowed: false,
      sortOrder: 20,
      isSystem: true,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      code: "SICK",
      name: "Sick Leave",
      description:
        "Leave used when an employee is unable to work because of illness or injury.",
      isPaid: true,
      requiresBalance: true,
      requiresDocument: true,
      documentRequiredAfter: 2,
      minimumNoticeDays: 0,
      allowsHalfDay: true,
      carryForwardAllowed: false,
      sortOrder: 20,
      isSystem: true,
    },
  })

  const currentYear = new Date().getUTCFullYear()
  const effectiveFrom = new Date(
    `${currentYear}-01-01T00:00:00.000Z`,
  )

  const rules = [
    {
      leaveTypeId: vacation.id,
      name: "Standard Vacation Entitlement",
      annualEntitlement: 15,
    },
    {
      leaveTypeId: sick.id,
      name: "Standard Sick Leave Entitlement",
      annualEntitlement: 14,
    },
  ]

  for (const rule of rules) {
    const existing =
      await prisma.leaveEntitlementRule.findFirst({
        where: {
          organizationId: organization.id,
          leaveTypeId: rule.leaveTypeId,
          name: rule.name,
          effectiveFrom,
        },
        select: {
          id: true,
        },
      })

    if (existing) {
      await prisma.leaveEntitlementRule.update({
        where: {
          id: existing.id,
        },
        data: {
          annualEntitlement:
            rule.annualEntitlement,
          accrualMethod:
            LeaveAccrualMethod.ANNUAL_GRANT,
          prorateFirstYear: true,
          prorateFinalYear: true,
          isActive: true,
        },
      })

      continue
    }

    await prisma.leaveEntitlementRule.create({
      data: {
        organizationId: organization.id,
        leaveTypeId: rule.leaveTypeId,
        name: rule.name,
        annualEntitlement:
          rule.annualEntitlement,
        accrualMethod:
          LeaveAccrualMethod.ANNUAL_GRANT,
        prorateFirstYear: true,
        prorateFinalYear: true,
        effectiveFrom,
        isActive: true,
      },
    })
  }

  console.log(
    `Leave types seeded for ${organization.name}.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
