import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  defaultTtGratuityPolicyInput,
  getGratuityPolicyAsOf,
  toGratuityPolicyInput,
} from "@/src/modules/payroll/data/get-gratuity-policy";
import { roundMoney } from "@/src/modules/payroll/lib/calculate-gratuity";
import { computeSettlementAmounts } from "@/src/modules/payroll/services/gratuity-settlement";

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function moneyDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

export type GratuityAccrualPostResult = {
  considered: number;
  posted: number;
  updated: number;
  skipped: number;
  periodKey: string;
  totalPeriodAccrual: number;
};

/**
 * Post (or true-up) monthly gratuity accrual entries for eligible open contracts.
 * Delta = current accrued-to-date − prior period cumulative for that contract.
 */
export async function postMonthlyGratuityAccruals(input?: {
  asOf?: Date;
  organizationId?: string;
  postedByUserId?: string | null;
}): Promise<GratuityAccrualPostResult> {
  const asOf = input?.asOf ?? new Date();
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  const key = periodKey(year, month);

  const contracts = await prisma.employmentContract.findMany({
    where: {
      gratuityEligible: true,
      status: {
        in: ["ACTIVE", "APPROVED", "AWAITING_SIGNATURE", "EXPIRED", "TERMINATED"],
      },
      ...(input?.organizationId
        ? { employee: { organizationId: input.organizationId } }
        : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      baseSalary: true,
      currency: true,
      gratuityEligible: true,
      gratuityRate: true,
      employeeId: true,
      employee: { select: { organizationId: true } },
      allowances: {
        select: {
          amount: true,
          frequency: true,
          includedInGratuity: true,
        },
      },
      gratuitySettlement: {
        select: {
          id: true,
          status: true,
          grossAmount: true,
          accruedAmount: true,
        },
      },
    },
  });

  let posted = 0;
  let updated = 0;
  let skipped = 0;
  let totalPeriodAccrual = 0;

  for (const contract of contracts) {
    if (
      contract.gratuitySettlement?.status === "PAID" ||
      contract.gratuitySettlement?.status === "VOID" ||
      contract.gratuitySettlement?.status === "INELIGIBLE"
    ) {
      skipped += 1;
      continue;
    }

    const policy = await getGratuityPolicyAsOf(contract.endDate ?? asOf);
    const policyInput = policy
      ? toGratuityPolicyInput(policy)
      : defaultTtGratuityPolicyInput();

    const amounts = computeSettlementAmounts(
      {
        startDate: contract.startDate,
        endDate: contract.endDate,
        baseSalary: contract.baseSalary.toString(),
        allowances: contract.allowances.map((row) => ({
          amount: row.amount.toString(),
          frequency: row.frequency,
          includedInGratuity: row.includedInGratuity,
        })),
        gratuityEligible: true,
        gratuityRate: contract.gratuityRate?.toString() ?? null,
      },
      policyInput,
      { asOf },
    );

    if (amounts.ineligibleReason || amounts.estimatedGrossGratuity <= 0) {
      skipped += 1;
      continue;
    }

    const grossObligation = amounts.estimatedGrossGratuity;
    const accruedToDate = amounts.accruedAmount;

    const prior = await prisma.gratuityAccrualEntry.findFirst({
      where: {
        contractId: contract.id,
        OR: [
          { periodYear: { lt: year } },
          { periodYear: year, periodMonth: { lt: month } },
        ],
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      select: { accruedToDate: true },
    });

    const priorAccrued = prior ? Number(prior.accruedToDate.toString()) : 0;
    const periodAccrual = roundMoney(accruedToDate - priorAccrued);

    if (Math.abs(periodAccrual) < 0.005) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.gratuityAccrualEntry.findUnique({
      where: {
        contractId_periodYear_periodMonth: {
          contractId: contract.id,
          periodYear: year,
          periodMonth: month,
        },
      },
      select: { id: true },
    });

    await prisma.gratuityAccrualEntry.upsert({
      where: {
        contractId_periodYear_periodMonth: {
          contractId: contract.id,
          periodYear: year,
          periodMonth: month,
        },
      },
      create: {
        organizationId: contract.employee.organizationId,
        employeeId: contract.employeeId,
        contractId: contract.id,
        settlementId: contract.gratuitySettlement?.id ?? null,
        periodYear: year,
        periodMonth: month,
        periodKey: key,
        currency: contract.currency,
        grossObligation: moneyDecimal(grossObligation),
        accruedToDate: moneyDecimal(accruedToDate),
        periodAccrualAmount: moneyDecimal(periodAccrual),
        postedByUserId: input?.postedByUserId ?? null,
        notes: `Monthly gratuity accrual through ${key}`,
      },
      update: {
        settlementId: contract.gratuitySettlement?.id ?? null,
        grossObligation: moneyDecimal(grossObligation),
        accruedToDate: moneyDecimal(accruedToDate),
        periodAccrualAmount: moneyDecimal(periodAccrual),
        postedAt: new Date(),
        postedByUserId: input?.postedByUserId ?? null,
        notes: `Monthly gratuity accrual true-up through ${key}`,
      },
    });

    if (contract.gratuitySettlement?.id) {
      await prisma.employeeGratuitySettlement.update({
        where: { id: contract.gratuitySettlement.id },
        data: {
          accruedAmount: moneyDecimal(accruedToDate),
          accrualThroughDate: new Date(
            Date.UTC(year, month - 1, Math.min(asOf.getUTCDate(), 28)),
          ),
        },
      });
    }

    if (existing) {
      updated += 1;
    } else {
      posted += 1;
    }
    totalPeriodAccrual += periodAccrual;
  }

  return {
    considered: contracts.length,
    posted,
    updated,
    skipped,
    periodKey: key,
    totalPeriodAccrual: roundMoney(totalPeriodAccrual),
  };
}

export type GratuityAccrualListItem = {
  id: string;
  periodKey: string;
  periodYear: number;
  periodMonth: number;
  employeeNumber: string;
  employeeName: string;
  contractId: string;
  jobTitle: string;
  currency: string;
  grossObligation: string;
  accruedToDate: string;
  periodAccrualAmount: string;
  postedAt: string;
};

export async function listGratuityAccrualEntries(options?: {
  year?: number;
  periodKey?: string;
}): Promise<GratuityAccrualListItem[]> {
  const year = options?.year ?? new Date().getUTCFullYear();
  const rows = await prisma.gratuityAccrualEntry.findMany({
    where: {
      periodYear: year,
      ...(options?.periodKey ? { periodKey: options.periodKey } : {}),
    },
    orderBy: [
      { periodMonth: "desc" },
      { postedAt: "desc" },
    ],
    select: {
      id: true,
      periodKey: true,
      periodYear: true,
      periodMonth: true,
      currency: true,
      grossObligation: true,
      accruedToDate: true,
      periodAccrualAmount: true,
      postedAt: true,
      contractId: true,
      contract: { select: { jobTitle: true } },
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    periodKey: row.periodKey,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    employeeNumber: row.employee.employeeNumber,
    employeeName:
      `${row.employee.preferredName ?? row.employee.firstName} ${row.employee.lastName}`.trim(),
    contractId: row.contractId,
    jobTitle: row.contract.jobTitle,
    currency: row.currency,
    grossObligation: Number(row.grossObligation.toString()).toFixed(2),
    accruedToDate: Number(row.accruedToDate.toString()).toFixed(2),
    periodAccrualAmount: Number(row.periodAccrualAmount.toString()).toFixed(2),
    postedAt: row.postedAt.toISOString(),
  }));
}
