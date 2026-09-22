/** Correction / off-cycle one-off adjustment line item codes. */

export type PayrollAdjustmentKind = "EARNING" | "DEDUCTION";

/** Manual salary / overpayment controls on a regular draft run. */
export type SalaryAdjustmentKind =
  | "SALARY_REDUCTION"
  | "OVERPAYMENT_RECOVERY";

export function isCorrectionAdjustmentCode(code: string): boolean {
  return code === "CORRECTION_EARNING" || code === "CORRECTION_DEDUCTION";
}

export function isSalaryAdjustmentCode(code: string, label: string): boolean {
  if (code === "OTHER_DEDUCTION" && /overpayment/i.test(label)) {
    return true;
  }
  if (code === "OTHER_EARNING" && /salary adjustment/i.test(label)) {
    return true;
  }
  return false;
}

export function correctionCodeForKind(
  kind: PayrollAdjustmentKind,
): "CORRECTION_EARNING" | "CORRECTION_DEDUCTION" {
  return kind === "EARNING" ? "CORRECTION_EARNING" : "CORRECTION_DEDUCTION";
}

export function defaultAdjustmentLabel(kind: PayrollAdjustmentKind): string {
  return kind === "EARNING" ? "Correction earning" : "Correction deduction";
}

export function salaryAdjustmentDefaults(kind: SalaryAdjustmentKind): {
  lineType: PayrollAdjustmentKind;
  code: "OTHER_EARNING" | "OTHER_DEDUCTION";
  label: string;
  /** Stored amount sign: reduction is a negative earning. */
  amountSign: 1 | -1;
  isTaxable: boolean;
} {
  if (kind === "SALARY_REDUCTION") {
    return {
      lineType: "EARNING",
      code: "OTHER_EARNING",
      label: "Salary adjustment (reduction)",
      amountSign: -1,
      isTaxable: true,
    };
  }
  return {
    lineType: "DEDUCTION",
    code: "OTHER_DEDUCTION",
    label: "Overpayment recovery",
    amountSign: 1,
    isTaxable: false,
  };
}

export function isSupplementalPayRunKind(
  runKind: string,
): runKind is "CORRECTION" | "OFF_CYCLE" {
  return runKind === "CORRECTION" || runKind === "OFF_CYCLE";
}
