/** Correction / off-cycle one-off adjustment line item codes. */

export type PayrollAdjustmentKind = "EARNING" | "DEDUCTION";

export function isCorrectionAdjustmentCode(code: string): boolean {
  return code === "CORRECTION_EARNING" || code === "CORRECTION_DEDUCTION";
}

export function correctionCodeForKind(
  kind: PayrollAdjustmentKind,
): "CORRECTION_EARNING" | "CORRECTION_DEDUCTION" {
  return kind === "EARNING" ? "CORRECTION_EARNING" : "CORRECTION_DEDUCTION";
}

export function defaultAdjustmentLabel(kind: PayrollAdjustmentKind): string {
  return kind === "EARNING" ? "Correction earning" : "Correction deduction";
}

export function isSupplementalPayRunKind(
  runKind: string,
): runKind is "CORRECTION" | "OFF_CYCLE" {
  return runKind === "CORRECTION" || runKind === "OFF_CYCLE";
}
