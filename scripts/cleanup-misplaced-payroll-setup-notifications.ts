/**
 * Remove misplaced "Payroll setup needed after contract activation"
 * notifications from users who do not hold payroll.setup / payroll.manage
 * (and are not SYSTEM_ADMINISTRATOR).
 *
 * Dry-run by default. Pass --apply to delete bad recipient rows.
 */
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { effectiveUserRoleWhere } from "../src/modules/auth/lib/effective-user-role"

const APPLY = process.argv.includes("--apply")

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function userHasPayrollStaffAccess(userId: string): Promise<boolean> {
  const match = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      roles: {
        some: {
          ...effectiveUserRoleWhere(),
          role: {
            isActive: true,
            OR: [
              { code: "SYSTEM_ADMINISTRATOR" },
              {
                permissions: {
                  some: {
                    permission: {
                      code: { in: ["payroll.setup", "payroll.manage"] },
                      isActive: true,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    select: { id: true },
  })
  return match != null
}

async function main() {
  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      notification: {
        title: "Payroll setup needed after contract activation",
      },
    },
    select: {
      notificationId: true,
      userId: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          employee: {
            select: { employeeNumber: true },
          },
        },
      },
      notification: {
        select: {
          message: true,
          createdAt: true,
        },
      },
    },
  })

  const toRemove: Array<{ notificationId: string; userId: string }> = []
  const samples: Array<Record<string, unknown>> = []

  for (const row of recipients) {
    const ok = await userHasPayrollStaffAccess(row.userId)
    if (!ok) {
      toRemove.push({
        notificationId: row.notificationId,
        userId: row.userId,
      })
      if (samples.length < 20) {
        samples.push({
          email: row.user.email,
          employeeNumber: row.user.employee?.employeeNumber ?? null,
          name: `${row.user.firstName} ${row.user.lastName}`,
          message: row.notification.message.slice(0, 120),
          at: row.notification.createdAt,
        })
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: recipients.length,
        wouldRemove: toRemove.length,
        apply: APPLY,
        samples,
      },
      null,
      2,
    ),
  )

  if (!APPLY || toRemove.length === 0) {
    return
  }

  let deleted = 0
  for (const row of toRemove) {
    await prisma.notificationRecipient.delete({
      where: {
        notificationId_userId: {
          notificationId: row.notificationId,
          userId: row.userId,
        },
      },
    })
    deleted += 1
  }
  console.log(`Deleted ${deleted} misplaced notification recipient(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
