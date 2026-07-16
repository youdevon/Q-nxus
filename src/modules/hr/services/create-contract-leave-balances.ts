import {
  LeaveBalanceTransactionType,
  Prisma,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateContractLeaveEntitlement } from "@/src/modules/hr/services/calculate-contract-leave-entitlement"

export type CreateContractLeaveBalancesResult = {
  contractId: string
  employeeId: string
  created: number
  updated: number
}

export async function createContractLeaveBalances(
  contractId: string,
  createdByUserId?: string | null,
): Promise<CreateContractLeaveBalancesResult> {
  const contract =
    await prisma.employmentContract.findUnique({
      where: {
        id: contractId,
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        employee: {
          select: {
            organizationId: true,
            employmentType: true,
          },
        },
      },
    })

  if (!contract) {
    throw new Error(
      "The employment contract could not be found.",
    )
  }

  if (!contract.endDate) {
    throw new Error(
      "A contract end date is required before leave balances can be generated.",
    )
  }

  const contractEndDate = contract.endDate

  const rules =
    await prisma.leaveEntitlementRule.findMany({
      where: {
        organizationId:
          contract.employee.organizationId,
        isActive: true,
        leaveType: {
          isActive: true,
          requiresBalance: true,
        },
        AND: [
          {
            OR: [
              {
                employmentType: null,
              },
              {
                employmentType:
                  contract.employee.employmentType,
              },
            ],
          },
          {
            effectiveFrom: {
              lte: contract.startDate,
            },
          },
          {
            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gte: contract.startDate,
                },
              },
            ],
          },
        ],
      },
      orderBy: [
        {
          priority: "desc",
        },
        {
          minimumServiceMonths: "desc",
        },
      ],
      select: {
        id: true,
        leaveTypeId: true,
        annualEntitlement: true,
        prorateFirstYear: true,
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    })

  const selectedRules = new Map<
    string,
    (typeof rules)[number]
  >()

  for (const rule of rules) {
    if (!selectedRules.has(rule.leaveTypeId)) {
      selectedRules.set(rule.leaveTypeId, rule)
    }
  }

  let created = 0
  let updated = 0

  for (const rule of selectedRules.values()) {
    const entitlement =
      calculateContractLeaveEntitlement({
        annualEntitlement:
          rule.annualEntitlement,
        contractStart: contract.startDate,
        contractEnd: contractEndDate,
        prorate: rule.prorateFirstYear,
      })

    const existing =
      await prisma.employeeLeaveBalance.findUnique({
        where: {
          contractId_leaveTypeId: {
            contractId: contract.id,
            leaveTypeId: rule.leaveTypeId,
          },
        },
        select: {
          id: true,
          availableBalance: true,
          taken: true,
          reserved: true,
          adjustments: true,
          carriedForward: true,
          accrued: true,
        },
      })

    if (existing) {
      const availableBalance = entitlement
        .plus(existing.accrued)
        .plus(existing.carriedForward)
        .plus(existing.adjustments)
        .minus(existing.reserved)
        .minus(existing.taken)

      await prisma.employeeLeaveBalance.update({
        where: {
          id: existing.id,
        },
        data: {
          employeeId: contract.employeeId,
          cycleStart: contract.startDate,
          cycleEnd: contractEndDate,
          entitlement,
          availableBalance,
          lastCalculatedAt: new Date(),
        },
      })

      updated += 1
      continue
    }

    await prisma.$transaction(async (tx) => {
      const balance =
        await tx.employeeLeaveBalance.create({
          data: {
            employeeId: contract.employeeId,
            contractId: contract.id,
            leaveTypeId: rule.leaveTypeId,
            cycleStart: contract.startDate,
            cycleEnd: contractEndDate,
            entitlement,
            availableBalance: entitlement,
            lastCalculatedAt: new Date(),
          },
        })

      await tx.leaveBalanceTransaction.create({
        data: {
          employeeId: contract.employeeId,
          contractId: contract.id,
          leaveTypeId: rule.leaveTypeId,
          leaveBalanceId: balance.id,
          transactionType:
            LeaveBalanceTransactionType.ENTITLEMENT,
          quantity: entitlement,
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: entitlement,
          effectiveDate: contract.startDate,
          referenceType: "EMPLOYMENT_CONTRACT",
          referenceId: contract.id,
          description:
            `${rule.leaveType.name} entitlement generated ` +
            `for contract period ` +
            `${contract.startDate.toISOString().slice(0, 10)} ` +
            `to ${contractEndDate.toISOString().slice(0, 10)}.`,
          createdByUserId:
            createdByUserId ?? null,
        },
      })
    })

    created += 1
  }

  return {
    contractId: contract.id,
    employeeId: contract.employeeId,
    created,
    updated,
  }
}
