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

const organizationId = "org-q-nxus-main"

const permissions = [
  {
    code: "notification.view_own",
    name: "View own notifications",
    moduleKey: "notifications",
  },
  {
    code: "people.profile.view_own",
    name: "View own employee profile",
    moduleKey: "people",
  },
  {
    code: "people.directory.view",
    name: "View employee directory",
    moduleKey: "people",
  },
  {
    code: "people.manage",
    name: "Manage people records",
    moduleKey: "people",
  },
  {
    code: "leave.request",
    name: "Request and manage own leave",
    moduleKey: "leave",
  },
  {
    code: "leave.approve",
    name: "Approve leave requests",
    moduleKey: "leave",
  },
  {
    code: "leave.manage",
    name: "Manage leave configuration",
    moduleKey: "leave",
  },
  {
    code: "contracts.view",
    name: "View contracts",
    moduleKey: "contracts",
  },
  {
    code: "contracts.manage",
    name: "Manage contracts",
    moduleKey: "contracts",
  },
  {
    code: "reports.view",
    name: "View reports",
    moduleKey: "reports",
  },
  {
    code: "payroll.view",
    name: "View payroll",
    moduleKey: "payroll",
  },
  {
    code: "documents.view",
    name: "View documents",
    moduleKey: "documents",
  },
  {
    code: "administration.view",
    name: "View administration",
    moduleKey: "administration",
  },
  {
    code: "administration.manage",
    name: "Manage administration",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_organization",
    name: "Manage organizations",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_business_unit",
    name: "Manage business units",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_location",
    name: "Manage locations",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_reference_data",
    name: "Manage reference data",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_feature",
    name: "Manage feature controls",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_domain_setting",
    name: "Manage domain settings",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_sequence",
    name: "Manage numbering sequences",
    moduleKey: "administration",
  },
  {
    code: "identity.user.view",
    name: "View users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.create",
    name: "Create users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.update",
    name: "Update users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.suspend",
    name: "Suspend users",
    moduleKey: "identity",
  },
  {
    code: "identity.role.view",
    name: "View roles",
    moduleKey: "identity",
  },
  {
    code: "identity.role.manage",
    name: "Manage roles",
    moduleKey: "identity",
  },
  {
    code: "identity.permission.view",
    name: "View permissions",
    moduleKey: "identity",
  },
  {
    code: "audit.view",
    name: "View audit events",
    moduleKey: "audit",
  },
] as const

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        moduleKey: permission.moduleKey,
        isActive: true,
      },
      create: {
        code: permission.code,
        name: permission.name,
        moduleKey: permission.moduleKey,
        isActive: true,
      },
    })
  }

  const employeeRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "EMPLOYEE",
      },
    },
    update: {
      name: "Employee",
      description:
        "Self-service access: own profile, own contracts (read-only), leave requests, and notifications.",
      isActive: true,
    },
    create: {
      organizationId,
      code: "EMPLOYEE",
      name: "Employee",
      description:
        "Self-service access: own profile, own contracts (read-only), leave requests, and notifications.",
      isActive: true,
    },
  })

  const hrRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "HR_ADMINISTRATOR",
      },
    },
    update: {
      name: "HR Administrator",
      description: "Manage people, leave, contracts, and structure.",
      isActive: true,
    },
    create: {
      organizationId,
      code: "HR_ADMINISTRATOR",
      name: "HR Administrator",
      description: "Manage people, leave, contracts, and structure.",
      isActive: true,
    },
  })

  const leaveApproverRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "LEAVE_APPROVER",
      },
    },
    update: {
      name: "Leave Approver",
      description:
        "Approve leave for direct reports. Assigned automatically to positions with reporting subordinates.",
      isActive: true,
    },
    create: {
      organizationId,
      code: "LEAVE_APPROVER",
      name: "Leave Approver",
      description:
        "Approve leave for direct reports. Assigned automatically to positions with reporting subordinates.",
      isActive: true,
    },
  })

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_code: {
        organizationId,
        code: "SYSTEM_ADMINISTRATOR",
      },
    },
  })

  const employeePermissionCodes = [
    "notification.view_own",
    "people.profile.view_own",
    "leave.request",
  ]

  const leaveApproverPermissionCodes = [
    ...employeePermissionCodes,
    "leave.approve",
  ]

  const hrPermissionCodes = [
    ...employeePermissionCodes,
    "people.directory.view",
    "people.manage",
    "leave.approve",
    "leave.manage",
    "contracts.view",
    "contracts.manage",
    "reports.view",
    "documents.view",
  ]

  async function grant(
    roleId: string,
    codes: string[],
  ) {
    for (const code of codes) {
      const permission = await prisma.permission.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
        },
      })

      if (!permission) {
        continue
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId: permission.id,
        },
      })
    }
  }

  await grant(employeeRole.id, employeePermissionCodes)
  await grant(leaveApproverRole.id, leaveApproverPermissionCodes)
  await grant(hrRole.id, hrPermissionCodes)

  const allPermissions = await prisma.permission.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    })
  }

  console.log("Access roles and permissions synchronized.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
