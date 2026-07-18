import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client"

/**
 * Synchronizes permission catalog and role templates.
 *
 * Run after pulling access-model changes:
 *   npm run seed:access
 *
 * Then assign roles in Administration → Access (or via position
 * systemRoleCode). Existing HR_ADMINISTRATOR grants that previously
 * included payroll are revoked on re-seed.
 */

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
    name: "Manage leave configuration and HR leave confirmation",
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
    code: "payroll.setup",
    name: "Edit employee payroll profiles and readiness setup",
    moduleKey: "payroll",
  },
  {
    code: "payroll.manage",
    name: "Manage pay runs, posting, and statutory payroll settings",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.view",
    name: "View employee bank accounts (masked)",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.view_sensitive",
    name: "View full employee bank account numbers",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.create",
    name: "Create employee bank accounts",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.update",
    name: "Update employee bank accounts",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.verify",
    name: "Verify employee bank accounts",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_accounts.disable",
    name: "Disable employee bank accounts",
    moduleKey: "payroll",
  },
  {
    code: "payroll.allocations.manage",
    name: "Manage employee payroll deposit allocations",
    moduleKey: "payroll",
  },
  {
    code: "payroll.financial_institutions.manage",
    name: "Manage financial institution directory",
    moduleKey: "payroll",
  },
  {
    code: "payroll.bank_export_profiles.manage",
    name: "Manage bank export profiles (activate / safe fields)",
    moduleKey: "payroll",
  },
  {
    code: "payroll.payment_returns.manage",
    name: "Mark payment returns/rejects and resolve failed disbursements",
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

const selfServicePermissionCodes = [
  "notification.view_own",
  "people.profile.view_own",
  "leave.request",
] as const

type RoleTemplate = {
  code: string
  name: string
  description: string
  permissionCodes: readonly string[]
}

const roleTemplates: RoleTemplate[] = [
  {
    code: "EMPLOYEE",
    name: "Employee",
    description:
      "Self-service: own profile, own leave requests, own payslip via /me. No org-wide HR or payroll directories.",
    permissionCodes: selfServicePermissionCodes,
  },
  {
    code: "LEAVE_APPROVER",
    name: "Leave Approver",
    description:
      "Approve leave for direct reports (reporting-officer path). Often assigned via position systemRoleCode.",
    permissionCodes: [...selfServicePermissionCodes, "leave.approve"],
  },
  {
    code: "HR_CLERK",
    name: "HR Clerk",
    description:
      "Create and edit people and contracts. Cannot approve leave or manage leave configuration.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "people.manage",
      "contracts.view",
      "contracts.manage",
      "documents.view",
    ],
  },
  {
    code: "HR_LEAVE_OFFICER",
    name: "HR Leave Officer",
    description:
      "Leave configuration, HR leave confirmation, and leave approvals. Does not manage people records.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "leave.approve",
      "leave.manage",
    ],
  },
  {
    code: "HR_ADMINISTRATOR",
    name: "HR Administrator",
    description:
      "Full HR: people, leave, contracts, and structure. Does not include the payroll module.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "people.manage",
      "leave.approve",
      "leave.manage",
      "contracts.view",
      "contracts.manage",
      "reports.view",
      "documents.view",
    ],
  },
  {
    code: "PAYROLL_CLERK",
    name: "Payroll Clerk",
    description:
      "View payroll and edit employee payroll profiles / readiness. Cannot post pay runs or change statutory settings.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "payroll.view",
      "payroll.setup",
      "payroll.bank_accounts.view",
      "payroll.bank_accounts.create",
      "payroll.bank_accounts.update",
      "payroll.allocations.manage",
    ],
  },
  {
    code: "PAYROLL_OFFICER",
    name: "Payroll Officer",
    description:
      "Full payroll operations: profiles, statutory settings, pay runs, and posting. No full HR people admin.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "payroll.view",
      "payroll.setup",
      "payroll.manage",
      "payroll.bank_accounts.view",
      "payroll.bank_accounts.view_sensitive",
      "payroll.bank_accounts.create",
      "payroll.bank_accounts.update",
      "payroll.bank_accounts.verify",
      "payroll.bank_accounts.disable",
      "payroll.allocations.manage",
      "payroll.financial_institutions.manage",
      "payroll.bank_export_profiles.manage",
      "payroll.payment_returns.manage",
    ],
  },
  {
    code: "HR_PAYROLL_ADMINISTRATOR",
    name: "HR & Payroll Administrator",
    description:
      "Combined HR Administrator and Payroll Officer access.",
    permissionCodes: [
      ...selfServicePermissionCodes,
      "people.directory.view",
      "people.manage",
      "leave.approve",
      "leave.manage",
      "contracts.view",
      "contracts.manage",
      "reports.view",
      "documents.view",
      "payroll.view",
      "payroll.setup",
      "payroll.manage",
      "payroll.bank_accounts.view",
      "payroll.bank_accounts.view_sensitive",
      "payroll.bank_accounts.create",
      "payroll.bank_accounts.update",
      "payroll.bank_accounts.verify",
      "payroll.bank_accounts.disable",
      "payroll.allocations.manage",
      "payroll.financial_institutions.manage",
      "payroll.bank_export_profiles.manage",
      "payroll.payment_returns.manage",
    ],
  },
]

async function upsertRole(template: RoleTemplate) {
  return prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: template.code,
      },
    },
    update: {
      name: template.name,
      description: template.description,
      isSystem: true,
      isActive: true,
    },
    create: {
      organizationId,
      code: template.code,
      name: template.name,
      description: template.description,
      isSystem: true,
      isActive: true,
    },
  })
}

/** Grant listed permissions and remove any extras for this role. */
async function syncRolePermissions(
  roleId: string,
  codes: readonly string[],
) {
  const desired = await prisma.permission.findMany({
    where: {
      code: { in: [...codes] },
      isActive: true,
    },
    select: { id: true, code: true },
  })

  const desiredIds = new Set(desired.map((permission) => permission.id))

  for (const permission of desired) {
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

  const existing = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  })

  const staleIds = existing
    .map((entry) => entry.permissionId)
    .filter((permissionId) => !desiredIds.has(permissionId))

  if (staleIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: staleIds },
      },
    })
  }
}

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

  for (const template of roleTemplates) {
    const role = await upsertRole(template)
    await syncRolePermissions(role.id, template.permissionCodes)
  }

  const adminRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "SYSTEM_ADMINISTRATOR",
      },
    },
    update: {
      name: "System Administrator",
      description: "Full platform administration access.",
      isSystem: true,
      isActive: true,
    },
    create: {
      organizationId,
      code: "SYSTEM_ADMINISTRATOR",
      name: "System Administrator",
      description: "Full platform administration access.",
      isSystem: true,
      isActive: true,
    },
  })

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

  console.log(
    "Access roles and permissions synchronized.",
    `Templates: ${roleTemplates.map((role) => role.code).join(", ")}, SYSTEM_ADMINISTRATOR.`,
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
