import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/src/modules/payroll/lib/calculate-gratuity";

export type ActualEligibleEarningsResult = {
  amount: number;
  payslipCount: number;
  /** REGULAR posted slips used (excludes pure gratuity OFF_CYCLE slips). */
  source: "ACTUAL_PAYROLL" | "NONE";
};

/**
 * Sum eligible gross earnings actually paid during the contract term.
 * Gratuity uses base salary only — allowances are never included.
 */
export async function sumActualEligibleContractEarnings(input: {
  employeeId: string;
  contractStart: Date;
  contractEnd: Date;
  /** @deprecated Ignored — gratuity is base salary only. */
  gratuityIncludedAllowanceNames?: string[];
  /** @deprecated Ignored — gratuity is base salary only. */
  totalAllowanceNames?: string[];
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
      lineItems: {
        select: { code: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

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
    used += 1;
  }

  return {
    amount: roundMoney(total),
    payslipCount: used,
    source: used > 0 ? "ACTUAL_PAYROLL" : "NONE",
  };
}
