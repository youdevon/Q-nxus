import { prisma } from "@/lib/prisma";
import type { GratuitySettlementStatus } from "@/generated/prisma/client";
import {
  inclusiveContractMonths,
  roundMoney,
} from "@/src/modules/payroll/lib/calculate-gratuity";
import {
  defaultTtGratuityPolicyInput,
  getGratuityPolicyAsOf,
  toGratuityPolicyInput,
  type GratuityPolicyRecord,
} from "@/src/modules/payroll/data/get-gratuity-policy";
import { computeSettlementAmounts } from "@/src/modules/payroll/services/gratuity-settlement";

const ELIGIBLE_CONTRACT_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "APPROVED",
  "AWAITING_SIGNATURE",
] as const;

const UNPAID_SETTLEMENT_STATUSES: GratuitySettlementStatus[] = [
  "ESTIMATED",
  "CALCULATED",
  "APPROVED",
  "SCHEDULED",
  "INELIGIBLE",
];

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function moneyString(value: { toString(): string } | number): string {
  const amount = typeof value === "number" ? value : Number(value.toString());
  return roundMoney(amount).toFixed(2);
}

function employeeDisplayName(employee: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return `${employee.preferredName ?? employee.firstName} ${employee.lastName}`.trim();
}

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

function monthsOverlappingYear(
  startDate: Date,
  endDate: Date,
  year: number,
): number {
  const { start: yearStart, end: yearEnd } = yearBounds(year);
  const clipStart = startDate > yearStart ? startDate : yearStart;
  const clipEnd = endDate < yearEnd ? endDate : yearEnd;
  if (clipEnd < clipStart) {
    return 0;
  }
  return inclusiveContractMonths(clipStart, clipEnd);
}

function isActiveInMonth(
  startDate: Date,
  endDate: Date,
  year: number,
  monthIndex: number,
): boolean {
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  return startDate <= monthEnd && endDate >= monthStart;
}

async function resolvePolicyInput(asOf: Date) {
  const policy = await getGratuityPolicyAsOf(asOf);
  return {
    policy,
    input: policy
      ? toGratuityPolicyInput(policy)
      : defaultTtGratuityPolicyInput(),
  };
}

const contractListSelect = {
  id: true,
  startDate: true,
  endDate: true,
  jobTitle: true,
  baseSalary: true,
  currency: true,
  gratuityEligible: true,
  gratuityRate: true,
  status: true,
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
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
      currency: true,
      formulaKind: true,
      ratePercent: true,
      contractMonths: true,
      serviceYears: true,
      monthlyEligibleEarnings: true,
      eligibleGrossEarnings: true,
      grossAmount: true,
      taxAmount: true,
      netAmount: true,
      accruedAmount: true,
      accrualThroughDate: true,
      estimatedAt: true,
      calculatedAt: true,
      approvedAt: true,
      scheduledAt: true,
      paidAt: true,
      voidedAt: true,
      voidReason: true,
      payRunId: true,
      payslipId: true,
      taxRemittanceStatus: true,
      taxRemittedAt: true,
      taxRemittanceReference: true,
      notes: true,
      policyId: true,
      calculationSnapshot: true,
    },
  },
} as const;

export type GratuitySettlementListItem = {
  contractId: string;
  settlementId: string | null;
  status: GratuitySettlementStatus | "PENDING_ESTIMATE";
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  jobTitle: string;
  contractStartDate: string;
  contractEndDate: string | null;
  baseSalary: string;
  currency: string;
  contractStatus: string;
  ratePercent: string;
  contractMonths: number;
  monthlyEligibleEarnings: string;
  eligibleGrossEarnings: string;
  grossAmount: string;
  taxAmount: string;
  netAmount: string;
  accruedAmount: string;
  payRunId: string | null;
  payslipId: string | null;
  taxRemittanceStatus: string | null;
  paidAt: string | null;
  approvedAt: string | null;
  scheduledAt: string | null;
  isSynthesized: boolean;
};

function mapSettlementRow(input: {
  contract: {
    id: string;
    startDate: Date;
    endDate: Date | null;
    jobTitle: string;
    baseSalary: { toString(): string };
    currency: string;
    status: string;
    gratuityRate: { toString(): string } | null;
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
    };
  };
  settlement: {
    id: string;
    status: GratuitySettlementStatus;
    ratePercent: { toString(): string };
    contractMonths: number;
    monthlyEligibleEarnings: { toString(): string };
    eligibleGrossEarnings: { toString(): string };
    grossAmount: { toString(): string };
    taxAmount: { toString(): string };
    netAmount: { toString(): string };
    accruedAmount: { toString(): string };
    payRunId: string | null;
    payslipId: string | null;
    taxRemittanceStatus: string;
    paidAt: Date | null;
    approvedAt: Date | null;
    scheduledAt: Date | null;
  } | null;
  estimate?: {
    ratePercent: number;
    contractMonths: number;
    monthlyEligibleEarnings: number;
    estimatedGrossEarnings: number;
    estimatedGrossGratuity: number;
    estimatedTax: number;
    estimatedNetGratuity: number;
    accruedAmount: number;
  };
}): GratuitySettlementListItem {
  const { contract, settlement, estimate } = input;
  const synthesized = !settlement && estimate != null;

  return {
    contractId: contract.id,
    settlementId: settlement?.id ?? null,
    status: settlement?.status ?? "PENDING_ESTIMATE",
    employeeId: contract.employee.id,
    employeeNumber: contract.employee.employeeNumber,
    employeeName: employeeDisplayName(contract.employee),
    jobTitle: contract.jobTitle,
    contractStartDate: toDateString(contract.startDate),
    contractEndDate: contract.endDate ? toDateString(contract.endDate) : null,
    baseSalary: moneyString(contract.baseSalary),
    currency: contract.currency,
    contractStatus: contract.status,
    ratePercent: settlement
      ? settlement.ratePercent.toString()
      : (estimate?.ratePercent.toFixed(4) ??
        contract.gratuityRate?.toString() ??
        "0"),
    contractMonths: settlement?.contractMonths ?? estimate?.contractMonths ?? 0,
    monthlyEligibleEarnings: settlement
      ? moneyString(settlement.monthlyEligibleEarnings)
      : moneyString(estimate?.monthlyEligibleEarnings ?? 0),
    eligibleGrossEarnings: settlement
      ? moneyString(settlement.eligibleGrossEarnings)
      : moneyString(estimate?.estimatedGrossEarnings ?? 0),
    grossAmount: settlement
      ? moneyString(settlement.grossAmount)
      : moneyString(estimate?.estimatedGrossGratuity ?? 0),
    taxAmount: settlement
      ? moneyString(settlement.taxAmount)
      : moneyString(estimate?.estimatedTax ?? 0),
    netAmount: settlement
      ? moneyString(settlement.netAmount)
      : moneyString(estimate?.estimatedNetGratuity ?? 0),
    accruedAmount: settlement
      ? moneyString(settlement.accruedAmount)
      : moneyString(estimate?.accruedAmount ?? 0),
    payRunId: settlement?.payRunId ?? null,
    payslipId: settlement?.payslipId ?? null,
    taxRemittanceStatus: settlement?.taxRemittanceStatus ?? null,
    paidAt: settlement?.paidAt ? settlement.paidAt.toISOString() : null,
    approvedAt: settlement?.approvedAt
      ? settlement.approvedAt.toISOString()
      : null,
    scheduledAt: settlement?.scheduledAt
      ? settlement.scheduledAt.toISOString()
      : null,
    isSynthesized: synthesized,
  };
}

export async function listUnpaidGratuitySettlements(options?: {
  year?: number;
}): Promise<GratuitySettlementListItem[]> {
  const year = options?.year;
  const asOf = new Date();
  const { input: policyInput } = await resolvePolicyInput(asOf);

  const contracts = await prisma.employmentContract.findMany({
    where: {
      gratuityEligible: true,
      status: { in: [...ELIGIBLE_CONTRACT_STATUSES] },
      ...(year
        ? {
            endDate: {
              gte: yearBounds(year).start,
              lte: yearBounds(year).end,
            },
          }
        : {}),
      OR: [
        { gratuitySettlement: null },
        {
          gratuitySettlement: {
            status: { in: UNPAID_SETTLEMENT_STATUSES },
          },
        },
        {
          gratuitySettlement: {
            status: "VOID",
          },
        },
      ],
    },
    select: contractListSelect,
    orderBy: [{ endDate: "asc" }, { startDate: "asc" }],
  });

  return contracts.map((contract) => {
    const settlement =
      contract.gratuitySettlement &&
      contract.gratuitySettlement.status !== "VOID"
        ? contract.gratuitySettlement
        : null;

    if (settlement) {
      return mapSettlementRow({ contract, settlement });
    }

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
        gratuityEligible: contract.gratuityEligible,
        gratuityRate: contract.gratuityRate?.toString() ?? null,
      },
      policyInput,
      { asOf },
    );

    return mapSettlementRow({
      contract,
      settlement: null,
      estimate: amounts,
    });
  });
}

export async function listPaidGratuitySettlements(options?: {
  year?: number;
}): Promise<GratuitySettlementListItem[]> {
  const year = options?.year;

  const settlements = await prisma.employeeGratuitySettlement.findMany({
    where: {
      status: "PAID",
      ...(year
        ? {
            OR: [
              {
                paidAt: {
                  gte: yearBounds(year).start,
                  lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
                },
              },
              {
                paidAt: null,
                contract: {
                  endDate: {
                    gte: yearBounds(year).start,
                    lte: yearBounds(year).end,
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      contract: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          jobTitle: true,
          baseSalary: true,
          currency: true,
          status: true,
          gratuityRate: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
      },
    },
    orderBy: [{ paidAt: "desc" }, { updatedAt: "desc" }],
  });

  return settlements.map((settlement) =>
    mapSettlementRow({
      contract: settlement.contract,
      settlement,
    }),
  );
}

export type GratuitySettlementDetail = GratuitySettlementListItem & {
  policyId: string | null;
  formulaKind: string | null;
  serviceYears: string | null;
  accrualThroughDate: string | null;
  estimatedAt: string | null;
  calculatedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  taxRemittedAt: string | null;
  taxRemittanceReference: string | null;
  notes: string | null;
  policy: GratuityPolicyRecord | null;
  earningsBasis: "CONTRACT_SCHEDULE" | "ACTUAL_PAYROLL" | null;
  contractEstimateGrossEarnings: string | null;
  contractEstimateGrossGratuity: string | null;
  varianceGrossEarnings: string | null;
  varianceGrossGratuity: string | null;
  actualPayslipCount: number | null;
};

function readVarianceFromSnapshot(snapshot: unknown): {
  earningsBasis: "CONTRACT_SCHEDULE" | "ACTUAL_PAYROLL" | null;
  contractEstimateGrossEarnings: string | null;
  contractEstimateGrossGratuity: string | null;
  varianceGrossEarnings: string | null;
  varianceGrossGratuity: string | null;
  actualPayslipCount: number | null;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      earningsBasis: null,
      contractEstimateGrossEarnings: null,
      contractEstimateGrossGratuity: null,
      varianceGrossEarnings: null,
      varianceGrossGratuity: null,
      actualPayslipCount: null,
    };
  }

  const record = snapshot as Record<string, unknown>;
  const variance =
    record.variance && typeof record.variance === "object"
      ? (record.variance as Record<string, unknown>)
      : null;
  const basis =
    record.earningsBasis === "ACTUAL_PAYROLL" ||
    record.earningsBasis === "CONTRACT_SCHEDULE"
      ? record.earningsBasis
      : null;

  const money = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return moneyString(value);
    }
    if (typeof value === "string" && value.length > 0) {
      return moneyString(Number(value));
    }
    return null;
  };

  return {
    earningsBasis: basis,
    contractEstimateGrossEarnings: money(
      variance?.contractEstimateGrossEarnings,
    ),
    contractEstimateGrossGratuity: money(
      variance?.contractEstimateGrossGratuity,
    ),
    varianceGrossEarnings: money(variance?.varianceGrossEarnings),
    varianceGrossGratuity: money(variance?.varianceGrossGratuity),
    actualPayslipCount:
      typeof variance?.actualPayslipCount === "number"
        ? variance.actualPayslipCount
        : null,
  };
}

export async function getGratuitySettlementForContract(
  contractId: string,
): Promise<GratuitySettlementDetail | null> {
  const contract = await prisma.employmentContract.findUnique({
    where: { id: contractId },
    select: contractListSelect,
  });

  if (!contract || !contract.gratuityEligible) {
    return null;
  }

  const asOf = new Date();
  const { policy, input: policyInput } = await resolvePolicyInput(
    contract.endDate ?? asOf,
  );

  const settlement =
    contract.gratuitySettlement &&
    contract.gratuitySettlement.status !== "VOID"
      ? contract.gratuitySettlement
      : null;

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
      gratuityEligible: contract.gratuityEligible,
      gratuityRate: contract.gratuityRate?.toString() ?? null,
    },
    policyInput,
    { asOf },
  );

  const base = mapSettlementRow({
    contract,
    settlement,
    estimate: settlement ? undefined : amounts,
  });

  const variance = readVarianceFromSnapshot(
    settlement && "calculationSnapshot" in settlement
      ? settlement.calculationSnapshot
      : null,
  );

  return {
    ...base,
    policyId: settlement?.policyId ?? policy?.id ?? null,
    formulaKind: settlement?.formulaKind ?? amounts.formulaKind,
    serviceYears:
      settlement?.serviceYears?.toString() ?? amounts.serviceYears.toFixed(4),
    accrualThroughDate: settlement?.accrualThroughDate
      ? toDateString(settlement.accrualThroughDate)
      : toDateString(asOf),
    estimatedAt: settlement?.estimatedAt?.toISOString() ?? null,
    calculatedAt: settlement?.calculatedAt?.toISOString() ?? null,
    voidedAt: settlement?.voidedAt?.toISOString() ?? null,
    voidReason: settlement?.voidReason ?? null,
    taxRemittedAt: settlement?.taxRemittedAt?.toISOString() ?? null,
    taxRemittanceReference: settlement?.taxRemittanceReference ?? null,
    notes: settlement?.notes ?? null,
    policy,
    earningsBasis: variance.earningsBasis ?? amounts.earningsBasis,
    contractEstimateGrossEarnings:
      variance.contractEstimateGrossEarnings ??
      moneyString(amounts.contractEstimateGrossEarnings),
    contractEstimateGrossGratuity:
      variance.contractEstimateGrossGratuity ??
      moneyString(amounts.contractEstimateGrossGratuity),
    varianceGrossEarnings:
      variance.varianceGrossEarnings ??
      moneyString(amounts.varianceGrossEarnings),
    varianceGrossGratuity:
      variance.varianceGrossGratuity ??
      moneyString(amounts.varianceGrossGratuity),
    actualPayslipCount:
      variance.actualPayslipCount ?? amounts.actualPayslipCount,
  };
}

export type GratuityBudgetMonth = {
  month: number;
  label: string;
  salaryOutlay: string;
  gratuityNet: string;
};

export type GratuityBudgetRow = {
  contractId: string;
  employeeNumber: string;
  employeeName: string;
  jobTitle: string;
  contractStartDate: string;
  contractEndDate: string | null;
  baseSalary: string;
  monthsInYear: number;
  salaryOutlay: string;
  grossAmount: string;
  taxAmount: string;
  netAmount: string;
  settlementStatus: string;
  paymentMonth: number | null;
};

export type GratuityBudgetForYear = {
  year: number;
  contractsEnding: number;
  salaryBudget: string;
  expectedGratuityGross: string;
  expectedGratuityTax: string;
  expectedGratuityNet: string;
  committedGratuityNet: string;
  paidGratuityNet: string;
  unpaidGratuityNet: string;
  byMonth: GratuityBudgetMonth[];
  rows: GratuityBudgetRow[];
  scenario: {
    rateOverridePercent: number | null;
    onlyCommitted: boolean;
    excludePendingEstimates: boolean;
    label: string;
  };
};

export type GratuityBudgetScenarioOptions = {
  /** What-if rate % instead of contract/policy rate. */
  rateOverridePercent?: number | null;
  /** Only APPROVED / SCHEDULED / PAID settlements (no soft estimates). */
  onlyCommitted?: boolean;
  /** Drop PENDING_ESTIMATE / ESTIMATED / CALCULATED soft rows from expected totals. */
  excludePendingEstimates?: boolean;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type DraftPayRunForGratuity = {
  id: string;
  runNumber: string;
  runKind: string;
  periodName: string;
  periodEnd: string;
};

export async function listDraftPayRunsForGratuity(): Promise<
  DraftPayRunForGratuity[]
> {
  const runs = await prisma.payRun.findMany({
    where: { status: "DRAFT" },
    select: {
      id: true,
      runNumber: true,
      runKind: true,
      payrollPeriod: {
        select: {
          name: true,
          periodEnd: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return runs.map((run) => ({
    id: run.id,
    runNumber: run.runNumber,
    runKind: run.runKind,
    periodName: run.payrollPeriod.name,
    periodEnd: toDateString(run.payrollPeriod.periodEnd),
  }));
}

export async function getGratuityBudgetForYear(
  year: number,
  scenario: GratuityBudgetScenarioOptions = {},
): Promise<GratuityBudgetForYear> {
  const { start, end } = yearBounds(year);
  const asOf = new Date();
  const { input: policyInput } = await resolvePolicyInput(
    new Date(Date.UTC(year, 11, 31)),
  );
  const rateOverride =
    scenario.rateOverridePercent != null &&
    Number.isFinite(scenario.rateOverridePercent)
      ? scenario.rateOverridePercent
      : null;
  const onlyCommitted = scenario.onlyCommitted === true;
  const excludePendingEstimates = scenario.excludePendingEstimates === true;

  const scenarioPolicy = rateOverride != null
    ? { ...policyInput, defaultRatePercent: rateOverride }
    : policyInput;

  const contracts = await prisma.employmentContract.findMany({
    where: {
      status: { in: [...ELIGIBLE_CONTRACT_STATUSES] },
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      jobTitle: true,
      baseSalary: true,
      gratuityEligible: true,
      gratuityRate: true,
      status: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
      allowances: {
        select: {
          amount: true,
          frequency: true,
          includedInGratuity: true,
        },
      },
      gratuitySettlement: {
        select: {
          status: true,
          grossAmount: true,
          taxAmount: true,
          netAmount: true,
        },
      },
    },
  });

  const monthSalary = Array.from({ length: 12 }, () => 0);
  const monthGratuity = Array.from({ length: 12 }, () => 0);
  let salaryBudget = 0;
  let expectedGross = 0;
  let expectedTax = 0;
  let expectedNet = 0;
  let committedNet = 0;
  let paidNet = 0;
  let contractsEnding = 0;
  const rows: GratuityBudgetRow[] = [];

  for (const contract of contracts) {
    const endDate = contract.endDate ?? end;
    const monthsInYear = monthsOverlappingYear(
      contract.startDate,
      endDate,
      year,
    );
    const baseSalary = Number(contract.baseSalary.toString());
    const salaryOutlay = roundMoney(baseSalary * monthsInYear);
    salaryBudget += salaryOutlay;

    for (let month = 0; month < 12; month += 1) {
      if (isActiveInMonth(contract.startDate, endDate, year, month)) {
        monthSalary[month] += baseSalary;
      }
    }

    const endsThisYear =
      contract.endDate != null &&
      contract.endDate >= start &&
      contract.endDate <= end;

    if (!contract.gratuityEligible || !endsThisYear) {
      continue;
    }

    contractsEnding += 1;
    const paymentMonth = contract.endDate!.getUTCMonth();

    const settlement =
      contract.gratuitySettlement &&
      contract.gratuitySettlement.status !== "VOID"
        ? contract.gratuitySettlement
        : null;

    let gross: number;
    let tax: number;
    let net: number;
    let status: string;

    const committedStatuses = new Set(["APPROVED", "SCHEDULED", "PAID"]);
    const softStatuses = new Set([
      "PENDING_ESTIMATE",
      "ESTIMATED",
      "CALCULATED",
    ]);

    if (settlement && rateOverride == null) {
      gross = Number(settlement.grossAmount.toString());
      tax = Number(settlement.taxAmount.toString());
      net = Number(settlement.netAmount.toString());
      status = settlement.status;

      if (settlement.status === "APPROVED" || settlement.status === "SCHEDULED") {
        committedNet += net;
      }
      if (settlement.status === "PAID") {
        paidNet += net;
      }
    } else {
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
          gratuityRate:
            rateOverride != null
              ? rateOverride
              : (contract.gratuityRate?.toString() ?? null),
        },
        scenarioPolicy,
        { asOf },
      );
      gross = amounts.estimatedGrossGratuity;
      tax = amounts.estimatedTax;
      net = amounts.estimatedNetGratuity;
      status = amounts.ineligibleReason
        ? "INELIGIBLE"
        : settlement?.status ?? "PENDING_ESTIMATE";

      if (settlement?.status === "APPROVED" || settlement?.status === "SCHEDULED") {
        committedNet += net;
      }
      if (settlement?.status === "PAID") {
        paidNet += Number(settlement.netAmount.toString());
      }
    }

    if (onlyCommitted && !committedStatuses.has(status)) {
      continue;
    }
    if (excludePendingEstimates && softStatuses.has(status)) {
      continue;
    }

    expectedGross += gross;
    expectedTax += tax;
    expectedNet += net;
    monthGratuity[paymentMonth] += net;

    rows.push({
      contractId: contract.id,
      employeeNumber: contract.employee.employeeNumber,
      employeeName: employeeDisplayName(contract.employee),
      jobTitle: contract.jobTitle,
      contractStartDate: toDateString(contract.startDate),
      contractEndDate: contract.endDate
        ? toDateString(contract.endDate)
        : null,
      baseSalary: moneyString(baseSalary),
      monthsInYear,
      salaryOutlay: moneyString(salaryOutlay),
      grossAmount: moneyString(gross),
      taxAmount: moneyString(tax),
      netAmount: moneyString(net),
      settlementStatus: status,
      paymentMonth: paymentMonth + 1,
    });
  }

  const unpaidNet = roundMoney(Math.max(0, expectedNet - paidNet));
  const scenarioBits = [
    rateOverride != null ? `rate ${rateOverride}%` : null,
    onlyCommitted ? "committed only" : null,
    excludePendingEstimates ? "exclude soft estimates" : null,
  ].filter(Boolean);

  return {
    year,
    contractsEnding: rows.length,
    salaryBudget: moneyString(salaryBudget),
    expectedGratuityGross: moneyString(expectedGross),
    expectedGratuityTax: moneyString(expectedTax),
    expectedGratuityNet: moneyString(expectedNet),
    committedGratuityNet: moneyString(committedNet),
    paidGratuityNet: moneyString(paidNet),
    unpaidGratuityNet: moneyString(unpaidNet),
    byMonth: MONTH_LABELS.map((label, index) => ({
      month: index + 1,
      label,
      salaryOutlay: moneyString(monthSalary[index]),
      gratuityNet: moneyString(monthGratuity[index]),
    })),
    rows: rows.sort((a, b) => {
      const aEnd = a.contractEndDate ?? "";
      const bEnd = b.contractEndDate ?? "";
      return aEnd.localeCompare(bEnd) || a.employeeName.localeCompare(b.employeeName);
    }),
    scenario: {
      rateOverridePercent: rateOverride,
      onlyCommitted,
      excludePendingEstimates,
      label: scenarioBits.length > 0 ? scenarioBits.join(" · ") : "Baseline",
    },
  };
}
