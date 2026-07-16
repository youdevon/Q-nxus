export type GratuityAllowanceInput = {
  amount: number | string;
  frequency: string;
  includedInGratuity: boolean;
};

export type ContractGratuityEstimate = {
  contractMonths: number;
  monthlyEligibleEarnings: number;
  estimatedGrossEarnings: number;
  estimatedGrossGratuity: number;
  estimatedTax: number;
  estimatedNetGratuity: number;
};

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/** Inclusive month span aligned with leave entitlement proration. */
export function inclusiveContractMonths(
  startDate: Date,
  endDate: Date,
): number {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);

  if (end < start) {
    throw new Error("Contract end date cannot be before its start date.");
  }

  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());

  const partialMonth = end.getUTCDate() >= start.getUTCDate() ? 1 : 0;

  return Math.max(1, months + partialMonth);
}

function annualizeAllowance(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * 52;
    case "BIWEEKLY":
      return amount * 26;
    case "PER_PAY_PERIOD":
      return amount * 12;
    case "ANNUAL":
      return amount;
    case "ONE_TIME":
      return 0;
    default:
      return amount * 12;
  }
}

function monthlyEligibleEarnings(
  baseSalary: number,
  allowances: GratuityAllowanceInput[],
): number {
  let annualAllowances = 0;

  for (const allowance of allowances) {
    if (!allowance.includedInGratuity) {
      continue;
    }

    const amount = Number(allowance.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    if (allowance.frequency === "ONE_TIME") {
      continue;
    }

    annualAllowances += annualizeAllowance(amount, allowance.frequency);
  }

  return baseSalary + annualAllowances / 12;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateContractGratuityEstimate({
  startDate,
  endDate,
  baseSalary,
  allowances = [],
  gratuityRate,
  gratuityTaxRate = 0,
}: {
  startDate: Date;
  endDate: Date;
  baseSalary: number | string;
  allowances?: GratuityAllowanceInput[];
  gratuityRate: number | string;
  gratuityTaxRate?: number | string | null;
}): ContractGratuityEstimate {
  const salary = Number(baseSalary);
  const rate = Number(gratuityRate);
  const taxRate = Number(gratuityTaxRate ?? 0);

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error("Base salary must be a valid number.");
  }

  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Gratuity rate must be a valid number.");
  }

  const contractMonths = inclusiveContractMonths(startDate, endDate);

  const monthly = monthlyEligibleEarnings(salary, allowances);
  const estimatedGrossEarnings = roundMoney(monthly * contractMonths);
  const estimatedGrossGratuity = roundMoney(
    estimatedGrossEarnings * (rate / 100),
  );
  const estimatedTax = roundMoney(
    estimatedGrossGratuity * (Number.isFinite(taxRate) ? taxRate / 100 : 0),
  );
  const estimatedNetGratuity = roundMoney(
    estimatedGrossGratuity - estimatedTax,
  );

  return {
    contractMonths,
    monthlyEligibleEarnings: roundMoney(monthly),
    estimatedGrossEarnings,
    estimatedGrossGratuity,
    estimatedTax,
    estimatedNetGratuity,
  };
}
