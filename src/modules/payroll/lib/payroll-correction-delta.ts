import { formatMoney } from "@/src/lib/format";

/** Bare monetary totals compared between an original and a correction payslip. */
export type PayslipAmountSet = {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export type PayslipDelta = PayslipAmountSet;

export type NetDeltaDirection = "increase" | "decrease" | "none";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Correction minus original for each total. Returns null when there is no
 * original slip to compare against (e.g. off-cycle payment with no prior run).
 */
export function computePayslipDelta(
  correction: PayslipAmountSet,
  original: PayslipAmountSet | null | undefined,
): PayslipDelta | null {
  if (!original) {
    return null;
  }

  return {
    grossPay: round(correction.grossPay - original.grossPay),
    totalDeductions: round(correction.totalDeductions - original.totalDeductions),
    netPay: round(correction.netPay - original.netPay),
  };
}

export function netDeltaDirection(
  delta: PayslipDelta | null | undefined,
): NetDeltaDirection {
  if (!delta || delta.netPay === 0) {
    return "none";
  }
  return delta.netPay > 0 ? "increase" : "decrease";
}

/** Signed money label: `+1,234.00`, `-1,234.00`, or `0.00` (never `-0.00`). */
export function formatSignedMoney(
  value: number,
  options?: { currency?: string },
): string {
  const normalized = value === 0 ? 0 : value;
  const magnitude = formatMoney(Math.abs(normalized), options);
  if (normalized > 0) {
    return `+${magnitude}`;
  }
  if (normalized < 0) {
    return `-${magnitude}`;
  }
  return magnitude;
}
