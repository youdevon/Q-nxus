/**
 * Contract gratuity calculation — policy-driven (TT MoF/IRD defaults via GratuityPolicy).
 *
 * Primary formula (PCT_OF_TERM_EARNINGS):
 *   Gross = Eligible Gross Earnings × rate%
 * Tax (TIERED, IRD):
 *   25% on first band, 30% on remainder (no personal allowance)
 */

export type GratuityAllowanceInput = {
  amount: number | string;
  frequency: string;
  includedInGratuity: boolean;
};

export type GratuityFormulaKind =
  | "PCT_OF_TERM_EARNINGS"
  | "PCT_OF_FINAL_MONTHLY_YEARS"
  | "DAYS_PER_YEAR"
  | "FLAT_AMOUNT"
  | "MANUAL";

export type GratuityTaxMode = "NONE" | "FLAT" | "TIERED";

export type GratuityTaxBandInput = {
  /** Inclusive upper bound; null/undefined = open-ended remainder. */
  upToAmount: number | string | null;
  ratePercent: number | string;
};

export type GratuityPolicyInput = {
  formulaKind: GratuityFormulaKind;
  defaultRatePercent: number | string;
  taxMode: GratuityTaxMode;
  flatTaxRatePercent?: number | string | null;
  applyPersonalAllowance?: boolean;
  minServiceMonths?: number | null;
  daysPerYearOfService?: number | string | null;
  daysInYearBasis?: number | null;
  taxBands?: GratuityTaxBandInput[];
};

export type ContractGratuityEstimate = {
  contractMonths: number;
  serviceYears: number;
  monthlyEligibleEarnings: number;
  estimatedGrossEarnings: number;
  estimatedGrossGratuity: number;
  estimatedTax: number;
  estimatedNetGratuity: number;
  ratePercent: number;
  formulaKind: GratuityFormulaKind;
  taxMode: GratuityTaxMode;
  ineligibleReason: string | null;
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

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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

export function monthlyEligibleEarnings(
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

/** IRD-style progressive tax on contract gratuity (no personal allowance). */
export function calculateGratuityTax({
  grossGratuity,
  taxMode,
  flatTaxRatePercent = 0,
  taxBands = [],
}: {
  grossGratuity: number;
  taxMode: GratuityTaxMode;
  flatTaxRatePercent?: number | string | null;
  taxBands?: GratuityTaxBandInput[];
}): number {
  if (!Number.isFinite(grossGratuity) || grossGratuity <= 0) {
    return 0;
  }

  if (taxMode === "NONE") {
    return 0;
  }

  if (taxMode === "FLAT") {
    const rate = Number(flatTaxRatePercent ?? 0);
    if (!Number.isFinite(rate) || rate < 0) {
      return 0;
    }
    return roundMoney(grossGratuity * (rate / 100));
  }

  const bands = [...taxBands]
    .map((band, index) => ({
      upTo:
        band.upToAmount == null || band.upToAmount === ""
          ? null
          : Number(band.upToAmount),
      rate: Number(band.ratePercent),
      index,
    }))
    .filter((band) => Number.isFinite(band.rate) && band.rate >= 0)
    .sort((a, b) => {
      if (a.upTo == null && b.upTo == null) return a.index - b.index;
      if (a.upTo == null) return 1;
      if (b.upTo == null) return -1;
      return a.upTo - b.upTo;
    });

  if (bands.length === 0) {
    return 0;
  }

  let remaining = grossGratuity;
  let previousCap = 0;
  let tax = 0;

  for (const band of bands) {
    if (remaining <= 0) {
      break;
    }

    const bandWidth =
      band.upTo == null ? remaining : Math.max(0, band.upTo - previousCap);
    const taxableInBand = Math.min(remaining, bandWidth);
    tax += taxableInBand * (band.rate / 100);
    remaining -= taxableInBand;

    if (band.upTo != null) {
      previousCap = band.upTo;
    }
  }

  return roundMoney(tax);
}

/** Default TT IRD bands: 25% to 1,000,000; 30% above. */
export const TT_DEFAULT_GRATUITY_TAX_BANDS: GratuityTaxBandInput[] = [
  { upToAmount: 1_000_000, ratePercent: 25 },
  { upToAmount: null, ratePercent: 30 },
];

export function calculateContractGratuity({
  startDate,
  endDate,
  baseSalary,
  allowances = [],
  ratePercent,
  policy,
  flatAmount,
  manualGross,
  eligibleGrossEarningsOverride,
}: {
  startDate: Date;
  endDate: Date;
  baseSalary: number | string;
  allowances?: GratuityAllowanceInput[];
  /** Contract override; falls back to policy.defaultRatePercent. */
  ratePercent?: number | string | null;
  policy: GratuityPolicyInput;
  flatAmount?: number | string | null;
  manualGross?: number | string | null;
  /**
   * When set (final settlement from posted payroll), replaces
   * monthly × months as the eligible gross earnings base.
   */
  eligibleGrossEarningsOverride?: number | string | null;
}): ContractGratuityEstimate {
  const salary = Number(baseSalary);
  const rate = Number(
    ratePercent != null && ratePercent !== ""
      ? ratePercent
      : policy.defaultRatePercent,
  );

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error("Base salary must be a valid number.");
  }

  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Gratuity rate must be a valid number.");
  }

  const contractMonths = inclusiveContractMonths(startDate, endDate);
  const serviceYears = roundMoney(contractMonths / 12);
  const monthly = monthlyEligibleEarnings(salary, allowances);
  const overrideGross =
    eligibleGrossEarningsOverride != null &&
    eligibleGrossEarningsOverride !== ""
      ? Number(eligibleGrossEarningsOverride)
      : null;
  const estimatedGrossEarnings = roundMoney(
    overrideGross != null && Number.isFinite(overrideGross) && overrideGross >= 0
      ? overrideGross
      : monthly * contractMonths,
  );

  let ineligibleReason: string | null = null;
  if (
    policy.minServiceMonths != null &&
    contractMonths < policy.minServiceMonths
  ) {
    ineligibleReason = `Minimum service of ${policy.minServiceMonths} months not met (${contractMonths} months).`;
  }

  let estimatedGrossGratuity = 0;

  switch (policy.formulaKind) {
    case "PCT_OF_TERM_EARNINGS":
      estimatedGrossGratuity = roundMoney(
        estimatedGrossEarnings * (rate / 100),
      );
      break;
    case "PCT_OF_FINAL_MONTHLY_YEARS":
      estimatedGrossGratuity = roundMoney(
        monthly * serviceYears * (rate / 100),
      );
      break;
    case "DAYS_PER_YEAR": {
      const daysPerYear = Number(policy.daysPerYearOfService ?? 15);
      const daysBasis = Number(policy.daysInYearBasis ?? 26);
      if (!Number.isFinite(daysPerYear) || daysPerYear < 0) {
        throw new Error("daysPerYearOfService must be a valid number.");
      }
      if (!Number.isFinite(daysBasis) || daysBasis <= 0) {
        throw new Error("daysInYearBasis must be a positive number.");
      }
      const daily = monthly / daysBasis;
      estimatedGrossGratuity = roundMoney(
        daily * daysPerYear * serviceYears,
      );
      break;
    }
    case "FLAT_AMOUNT": {
      const flat = Number(flatAmount ?? 0);
      if (!Number.isFinite(flat) || flat < 0) {
        throw new Error("Flat gratuity amount must be a valid number.");
      }
      estimatedGrossGratuity = roundMoney(flat);
      break;
    }
    case "MANUAL": {
      const manual = Number(manualGross ?? 0);
      if (!Number.isFinite(manual) || manual < 0) {
        throw new Error("Manual gratuity amount must be a valid number.");
      }
      estimatedGrossGratuity = roundMoney(manual);
      break;
    }
    default:
      throw new Error(`Unsupported gratuity formula: ${policy.formulaKind}`);
  }

  if (ineligibleReason) {
    estimatedGrossGratuity = 0;
  }

  const estimatedTax = calculateGratuityTax({
    grossGratuity: estimatedGrossGratuity,
    taxMode: policy.taxMode,
    flatTaxRatePercent: policy.flatTaxRatePercent,
    taxBands: policy.taxBands,
  });

  const estimatedNetGratuity = roundMoney(
    estimatedGrossGratuity - estimatedTax,
  );

  return {
    contractMonths,
    serviceYears,
    monthlyEligibleEarnings: roundMoney(monthly),
    estimatedGrossEarnings,
    estimatedGrossGratuity,
    estimatedTax,
    estimatedNetGratuity,
    ratePercent: rate,
    formulaKind: policy.formulaKind,
    taxMode: policy.taxMode,
    ineligibleReason,
  };
}

/**
 * @deprecated Prefer {@link calculateContractGratuity} with a policy.
 * Kept for contract form / callers that still pass flat tax rate.
 */
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
}): Omit<
  ContractGratuityEstimate,
  "serviceYears" | "ratePercent" | "formulaKind" | "taxMode" | "ineligibleReason"
> & {
  contractMonths: number;
  monthlyEligibleEarnings: number;
  estimatedGrossEarnings: number;
  estimatedGrossGratuity: number;
  estimatedTax: number;
  estimatedNetGratuity: number;
} {
  const result = calculateContractGratuity({
    startDate,
    endDate,
    baseSalary,
    allowances,
    ratePercent: gratuityRate,
    policy: {
      formulaKind: "PCT_OF_TERM_EARNINGS",
      defaultRatePercent: gratuityRate,
      taxMode: "FLAT",
      flatTaxRatePercent: gratuityTaxRate ?? 0,
      taxBands: [],
    },
  });

  return {
    contractMonths: result.contractMonths,
    monthlyEligibleEarnings: result.monthlyEligibleEarnings,
    estimatedGrossEarnings: result.estimatedGrossEarnings,
    estimatedGrossGratuity: result.estimatedGrossGratuity,
    estimatedTax: result.estimatedTax,
    estimatedNetGratuity: result.estimatedNetGratuity,
  };
}
