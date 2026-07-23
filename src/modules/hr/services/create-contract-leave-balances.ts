import { LeaveBalanceTransactionType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  entitlementOverridesFromContractFields,
  type LeaveEntitlementOverride,
} from "@/src/modules/hr/lib/contract-leave-overrides";
import { calculateContractLeaveEntitlement } from "@/src/modules/hr/services/calculate-contract-leave-entitlement";

export type { LeaveEntitlementOverride };

export type CreateContractLeaveBalancesOptions = {
  entitlementOverrides?: LeaveEntitlementOverride[];
};

export type CreateContractLeaveBalancesResult = {
  contractId: string;
  employeeId: string;
  created: number;
  updated: number;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Pass `db` as an open transaction client to make balance generation atomic
 * with the surrounding write (e.g. contract creation). Defaults to the shared
 * Prisma client for standalone use.
 */
export async function createContractLeaveBalances(
  contractId: string,
  createdByUserId?: string | null,
  options?: CreateContractLeaveBalancesOptions,
  db: DbClient = prisma,
): Promise<CreateContractLeaveBalancesResult> {
  const contract = await db.employmentContract.findUnique({
    where: {
      id: contractId,
    },
    select: {
      id: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      vacationLeaveDaysOverride: true,
      sickLeaveDaysOverride: true,
      employee: {
        select: {
          organizationId: true,
          employmentType: true,
        },
      },
    },
  });

  if (!contract) {
    throw new Error("The employment contract could not be found.");
  }

  if (!contract.endDate) {
    throw new Error(
      "A contract end date is required before leave balances can be generated.",
    );
  }

  const contractEndDate = contract.endDate;
  const overrideByCode = new Map(
    entitlementOverridesFromContractFields(contract).map((override) => [
      override.leaveTypeCode.toUpperCase(),
      override.entitlementDays,
    ]),
  );

  // Explicit options win over stored contract columns (same codes).
  for (const override of options?.entitlementOverrides ?? []) {
    overrideByCode.set(
      override.leaveTypeCode.toUpperCase(),
      override.entitlementDays,
    );
  }

  const rules = await db.leaveEntitlementRule.findMany({
    where: {
      organizationId: contract.employee.organizationId,
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
              employmentType: contract.employee.employmentType,
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
          code: true,
          name: true,
        },
      },
    },
  });

  const selectedRules = new Map<string, (typeof rules)[number]>();

  for (const rule of rules) {
    if (!selectedRules.has(rule.leaveTypeId)) {
      selectedRules.set(rule.leaveTypeId, rule);
    }
  }

  type BalancePlan = {
    leaveTypeId: string;
    leaveTypeCode: string;
    leaveTypeName: string;
    entitlement: Prisma.Decimal;
  };

  const plans: BalancePlan[] = [];
  const plannedTypeIds = new Set<string>();

  for (const rule of selectedRules.values()) {
    const overrideDays = overrideByCode.get(rule.leaveType.code.toUpperCase());
    const entitlement =
      overrideDays !== undefined
        ? new Prisma.Decimal(overrideDays)
        : calculateContractLeaveEntitlement({
            annualEntitlement: rule.annualEntitlement,
            contractStart: contract.startDate,
            contractEnd: contractEndDate,
            prorate: rule.prorateFirstYear,
          });

    plans.push({
      leaveTypeId: rule.leaveTypeId,
      leaveTypeCode: rule.leaveType.code,
      leaveTypeName: rule.leaveType.name,
      entitlement,
    });
    plannedTypeIds.add(rule.leaveTypeId);
    overrideByCode.delete(rule.leaveType.code.toUpperCase());
  }

  // Overrides for leave types that have no matching entitlement rule.
  if (overrideByCode.size > 0) {
    const leftoverCodes = [...overrideByCode.keys()];
    const leaveTypes = await db.leaveType.findMany({
      where: {
        organizationId: contract.employee.organizationId,
        isActive: true,
        requiresBalance: true,
        code: {
          in: leftoverCodes,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    for (const leaveType of leaveTypes) {
      if (plannedTypeIds.has(leaveType.id)) {
        continue;
      }

      const overrideDays = overrideByCode.get(leaveType.code.toUpperCase());

      if (overrideDays === undefined) {
        continue;
      }

      plans.push({
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        leaveTypeName: leaveType.name,
        entitlement: new Prisma.Decimal(overrideDays),
      });
      plannedTypeIds.add(leaveType.id);
    }
  }

  let created = 0;
  let updated = 0;

  for (const plan of plans) {
    // One active balance row per contract+type; cycle window may be updated in place.
    const existing = await db.employeeLeaveBalance.findFirst({
      where: {
        contractId: contract.id,
        leaveTypeId: plan.leaveTypeId,
      },
      orderBy: [{ cycleEnd: "desc" }],
      select: {
        id: true,
        availableBalance: true,
        taken: true,
        reserved: true,
        adjustments: true,
        carriedForward: true,
        accrued: true,
        openingBalance: true,
      },
    });

    if (existing) {
      const availableBalance = existing.openingBalance
        .plus(plan.entitlement)
        .plus(existing.accrued)
        .plus(existing.carriedForward)
        .plus(existing.adjustments)
        .minus(existing.reserved)
        .minus(existing.taken);

      await db.employeeLeaveBalance.update({
        where: {
          id: existing.id,
        },
        data: {
          employeeId: contract.employeeId,
          cycleStart: contract.startDate,
          cycleEnd: contractEndDate,
          entitlement: plan.entitlement,
          availableBalance,
          lastCalculatedAt: new Date(),
        },
      });

      updated += 1;
      continue;
    }

    const writeBalanceWithLedger = async (tx: Prisma.TransactionClient) => {
      const balance = await tx.employeeLeaveBalance.create({
        data: {
          employeeId: contract.employeeId,
          contractId: contract.id,
          leaveTypeId: plan.leaveTypeId,
          cycleStart: contract.startDate,
          cycleEnd: contractEndDate,
          entitlement: plan.entitlement,
          availableBalance: plan.entitlement,
          lastCalculatedAt: new Date(),
        },
      });

      await tx.leaveBalanceTransaction.create({
        data: {
          employeeId: contract.employeeId,
          contractId: contract.id,
          leaveTypeId: plan.leaveTypeId,
          leaveBalanceId: balance.id,
          transactionType: LeaveBalanceTransactionType.ENTITLEMENT,
          quantity: plan.entitlement,
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: plan.entitlement,
          effectiveDate: contract.startDate,
          referenceType: "EMPLOYMENT_CONTRACT",
          referenceId: contract.id,
          description:
            `${plan.leaveTypeName} entitlement generated ` +
            `for contract period ` +
            `${contract.startDate.toISOString().slice(0, 10)} ` +
            `to ${contractEndDate.toISOString().slice(0, 10)}.`,
          createdByUserId: createdByUserId ?? null,
        },
      });
    };

    // Balance + ledger entry stay atomic: reuse the caller's transaction when
    // one was passed in, otherwise open a local one.
    if ("$transaction" in db) {
      await db.$transaction(writeBalanceWithLedger);
    } else {
      await writeBalanceWithLedger(db);
    }

    created += 1;
  }

  return {
    contractId: contract.id,
    employeeId: contract.employeeId,
    created,
    updated,
  };
}
