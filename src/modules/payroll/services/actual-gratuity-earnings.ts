import { prisma } from "@/lib/prisma";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import { roundMoney } from "@/src/modules/payroll/lib/calculate-gratuity";

export type ActualEligibleEarningsResult = {
  amount: number;
  payslipCount: number;
  /** REGULAR posted slips used (excludes pure gratuity OFF_CYCLE slips). */
  source: "ACTUAL_PAYROLL" | "NONE";
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Sum eligible gross earnings actually paid during the contract term.
 * Uses posted payslip base salary + earnings whose labels match
 * gratuity-included allowance names. Falls back to a share of
 * allowancesTotal when labels cannot be matched.
 */
export async function sumActualEligibleContractEarnings(input: {
  employeeId: string;
  contractStart: Date;
  contractEnd: Date;
  gratuityIncludedAllowanceNames: string[];
  totalAllowanceNames: string[];
}): Promise<ActualEligibleEarningsResult> {
  const slips = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      payrollPeriod: {
        periodEnd: { gte: input.contractStart },
        periodStart: { lte: input.contractEnd },
      },
      payRun: {
        OR: [{ runKind: "REGULAR" }, { runKind: "OFF_CYCLE" }],
      },
    },
    select: {
      id: true,
      baseSalary: true,
      allowancesTotal: true,
      grossPay: true,
      snapshot: true,
      payRun: { select: { runKind: true } },
      lineItems: {
        select: { code: true, lineType: true, amount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const includedLabels = new Set(
    input.gratuityIncludedAllowanceNames.map(normalizeLabel).filter(Boolean),
  );
  const allAllowanceLabels = input.totalAllowanceNames
    .map(normalizeLabel)
    .filter(Boolean);
  const includedShare =
    allAllowanceLabels.length === 0
      ? 0
      : includedLabels.size / allAllowanceLabels.length;

  let total = 0;
  let used = 0;

  for (const slip of slips) {
    const hasGratuityLine = slip.lineItems.some(
      (line) => line.code === "GRATUITY" || line.code === "GRATUITY_TAX",
    );
    const base = Number(slip.baseSalary.toString());
    // Skip gratuity-only off-cycle slips (zero/near-zero base + gratuity lines).
    if (hasGratuityLine && base < 0.01) {
      continue;
    }

    total += base;

    const allowancesTotal = Number(slip.allowancesTotal.toString());
    let matchedAllowances = 0;
    let matchedAny = false;

    const snapshot = parsePayslipSnapshot(slip.snapshot);
    if (snapshot && includedLabels.size > 0) {
      for (const earning of snapshot.payslip.earnings) {
        const label = normalizeLabel(earning.label);
        if (label.includes("base") || label.includes("salary")) {
          continue;
        }
        if (includedLabels.has(label)) {
          matchedAllowances += earning.amount;
          matchedAny = true;
        }
      }
    }

    if (matchedAny) {
      total += matchedAllowances;
    } else if (allowancesTotal > 0 && includedShare > 0) {
      total += allowancesTotal * includedShare;
    }

    used += 1;
  }

  return {
    amount: roundMoney(total),
    payslipCount: used,
    source: used > 0 ? "ACTUAL_PAYROLL" : "NONE",
  };
}
