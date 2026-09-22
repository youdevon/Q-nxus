/**
 * Projected tax-year position shown on payslips.
 * Distinct from YTD (actual paid) — these figures are estimates.
 * Field set mirrors the Employee Annual PAYE Projection worksheet.
 */

function num(value: { toString(): string } | number): number {
  return Number(value.toString());
}

export type ProjectedTaxYearPosition = {
  taxYear: number;
  version: number;
  calculationDate: string;
  payFrequency: string;

  previousEmployerTaxableIncome: number;
  previousEmployerPaye: number;
  currentEmployerActualTaxableIncome: number;
  currentEmployerPaye: number;
  projectedRemainingTaxableIncome: number;

  projectedAnnualTaxableIncome: number;
  personalAllowance: number;
  allowableQualifyingDeduction: number;
  projectedChargeableIncome: number;
  projectedAnnualTaxLiability: number;
  manualTaxAdjustment: number;
  remainingTaxLiability: number;
  remainingPayrollPeriods: number;
  recommendedPayePerPeriod: number | null;
};

export function toProjectedTaxYearPosition(row: {
  taxYear: number;
  version: number;
  calculationDate: Date | string;
  payFrequency: string;
  previousEmployerTaxableIncome: { toString(): string } | number;
  previousEmployerPaye: { toString(): string } | number;
  currentEmployerActualTaxableIncome: { toString(): string } | number;
  currentEmployerPaye: { toString(): string } | number;
  projectedRemainingTaxableIncome: { toString(): string } | number;
  projectedAnnualTaxableIncome: { toString(): string } | number;
  personalAllowance: { toString(): string } | number;
  allowableQualifyingDeduction: { toString(): string } | number;
  projectedChargeableIncome: { toString(): string } | number;
  projectedAnnualTaxLiability: { toString(): string } | number;
  manualTaxAdjustment: { toString(): string } | number;
  remainingTaxLiability: { toString(): string } | number;
  remainingPayrollPeriods: number;
  recommendedPayePerPeriod: { toString(): string } | number | null;
}): ProjectedTaxYearPosition {
  const calcDate =
    typeof row.calculationDate === "string"
      ? row.calculationDate.slice(0, 10)
      : row.calculationDate.toISOString().slice(0, 10);

  return {
    taxYear: row.taxYear,
    version: row.version,
    calculationDate: calcDate,
    payFrequency: row.payFrequency,
    previousEmployerTaxableIncome: num(row.previousEmployerTaxableIncome),
    previousEmployerPaye: num(row.previousEmployerPaye),
    currentEmployerActualTaxableIncome: num(
      row.currentEmployerActualTaxableIncome,
    ),
    currentEmployerPaye: num(row.currentEmployerPaye),
    projectedRemainingTaxableIncome: num(row.projectedRemainingTaxableIncome),
    projectedAnnualTaxableIncome: num(row.projectedAnnualTaxableIncome),
    personalAllowance: num(row.personalAllowance),
    allowableQualifyingDeduction: num(row.allowableQualifyingDeduction),
    projectedChargeableIncome: num(row.projectedChargeableIncome),
    projectedAnnualTaxLiability: num(row.projectedAnnualTaxLiability),
    manualTaxAdjustment: num(row.manualTaxAdjustment),
    remainingTaxLiability: num(row.remainingTaxLiability),
    remainingPayrollPeriods: row.remainingPayrollPeriods,
    recommendedPayePerPeriod:
      row.recommendedPayePerPeriod == null
        ? null
        : num(row.recommendedPayePerPeriod),
  };
}
