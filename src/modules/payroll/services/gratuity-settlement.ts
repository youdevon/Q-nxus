import {
  calculateContractGratuity,
  inclusiveContractMonths,
  roundMoney,
  type ContractGratuityEstimate,
  type GratuityAllowanceInput,
  type GratuityPolicyInput,
} from "@/src/modules/payroll/lib/calculate-gratuity";

export type SettlementContractInput = {
  startDate: Date;
  endDate: Date | null;
  baseSalary: number | string;
  allowances?: GratuityAllowanceInput[];
  gratuityEligible: boolean;
  gratuityRate?: number | string | null;
};

export type SettlementAmounts = ContractGratuityEstimate & {
  endDateUsed: Date;
  accruedAmount: number;
  /** Contract-schedule estimate before any actual-payroll override. */
  contractEstimateGrossEarnings: number;
  contractEstimateGrossGratuity: number;
  earningsBasis: "CONTRACT_SCHEDULE" | "ACTUAL_PAYROLL";
  actualPayslipCount: number;
  varianceGrossEarnings: number;
  varianceGrossGratuity: number;
};

export function resolveContractEndDate(
  endDate: Date | null,
  options?: { asOf?: Date; requireEndDate?: boolean },
): Date {
  if (endDate) {
    return endDate;
  }

  if (options?.requireEndDate) {
    throw new Error("Contract end date is required to calculate gratuity.");
  }

  return options?.asOf ?? new Date();
}

/**
 * Prorate gross obligation by elapsed inclusive months / total contract months.
 */
export function accruedGratuityToDate({
  grossObligation,
  contractStart,
  contractEnd,
  asOf,
}: {
  grossObligation: number;
  contractStart: Date;
  contractEnd: Date;
  asOf: Date;
}): number {
  if (!Number.isFinite(grossObligation) || grossObligation <= 0) {
    return 0;
  }

  const totalMonths = inclusiveContractMonths(contractStart, contractEnd);
  if (totalMonths <= 0) {
    return 0;
  }

  if (asOf < contractStart) {
    return 0;
  }

  const through = asOf > contractEnd ? contractEnd : asOf;
  const elapsedMonths = inclusiveContractMonths(contractStart, through);

  return roundMoney(grossObligation * (elapsedMonths / totalMonths));
}

export function computeSettlementAmounts(
  contract: SettlementContractInput,
  policy: GratuityPolicyInput,
  options?: {
    asOf?: Date;
    flatAmount?: number | string | null;
    manualGross?: number | string | null;
    requireEndDate?: boolean;
    /** Posted payroll eligible gross; when set, used as final earnings basis. */
    actualEligibleGrossEarnings?: number | null;
    actualPayslipCount?: number;
  },
): SettlementAmounts {
  const asOf = options?.asOf ?? new Date();
  const endDateUsed = resolveContractEndDate(contract.endDate, {
    asOf,
    requireEndDate: options?.requireEndDate,
  });

  const emptyVariance = {
    contractEstimateGrossEarnings: 0,
    contractEstimateGrossGratuity: 0,
    earningsBasis: "CONTRACT_SCHEDULE" as const,
    actualPayslipCount: 0,
    varianceGrossEarnings: 0,
    varianceGrossGratuity: 0,
  };

  if (!contract.gratuityEligible) {
    return {
      contractMonths: 0,
      serviceYears: 0,
      monthlyEligibleEarnings: 0,
      estimatedGrossEarnings: 0,
      estimatedGrossGratuity: 0,
      estimatedTax: 0,
      estimatedNetGratuity: 0,
      ratePercent: Number(policy.defaultRatePercent) || 0,
      formulaKind: policy.formulaKind,
      taxMode: policy.taxMode,
      ineligibleReason: "Contract is not gratuity-eligible.",
      endDateUsed,
      accruedAmount: 0,
      ...emptyVariance,
    };
  }

  const contractEstimate = calculateContractGratuity({
    startDate: contract.startDate,
    endDate: endDateUsed,
    baseSalary: contract.baseSalary,
    allowances: contract.allowances ?? [],
    ratePercent: contract.gratuityRate,
    policy,
    flatAmount: options?.flatAmount,
    manualGross: options?.manualGross,
  });

  const useActual =
    options?.actualEligibleGrossEarnings != null &&
    Number.isFinite(options.actualEligibleGrossEarnings) &&
    options.actualEligibleGrossEarnings > 0 &&
    (options.actualPayslipCount ?? 0) > 0;

  const estimate = useActual
    ? calculateContractGratuity({
        startDate: contract.startDate,
        endDate: endDateUsed,
        baseSalary: contract.baseSalary,
        allowances: contract.allowances ?? [],
        ratePercent: contract.gratuityRate,
        policy,
        flatAmount: options?.flatAmount,
        manualGross: options?.manualGross,
        eligibleGrossEarningsOverride: options?.actualEligibleGrossEarnings,
      })
    : contractEstimate;

  const accruedAmount = accruedGratuityToDate({
    grossObligation: estimate.estimatedGrossGratuity,
    contractStart: contract.startDate,
    contractEnd: endDateUsed,
    asOf,
  });

  return {
    ...estimate,
    endDateUsed,
    accruedAmount,
    contractEstimateGrossEarnings: contractEstimate.estimatedGrossEarnings,
    contractEstimateGrossGratuity: contractEstimate.estimatedGrossGratuity,
    earningsBasis: useActual ? "ACTUAL_PAYROLL" : "CONTRACT_SCHEDULE",
    actualPayslipCount: options?.actualPayslipCount ?? 0,
    varianceGrossEarnings: roundMoney(
      estimate.estimatedGrossEarnings -
        contractEstimate.estimatedGrossEarnings,
    ),
    varianceGrossGratuity: roundMoney(
      estimate.estimatedGrossGratuity -
        contractEstimate.estimatedGrossGratuity,
    ),
  };
}
