import { formatMoney } from "@/src/lib/format";
import { roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

/**
 * Correction delta helpers (Phase B).
 *
 * Product rule for CORRECTION runs linked to a sourcePayRun:
 * compare the source *posted* payslip snapshot to a freshly reassembled
 * preview (current master data), then generate CORRECTION_* line items for
 * net differences by category so the correction run can *pay the delta*
 * (not a second full-period payslip). OFF_CYCLE / REGULAR are unchanged.
 *
 * Category mapping (target − source):
 * - grossEarnings → CORRECTION_EARNING (signed)
 * - paye / nis / health / otherDeductions → CORRECTION_DEDUCTION (signed)
 *
 * Statutory labels on auto deduction lines match YTD extractors
 * (`PAYE (income tax)`, `NIS (employee)`, `Health Surcharge`).
 *
 * Auto lines are tagged in `notes` with {@link AUTO_DELTA_NOTES_PREFIX} so
 * Recalculate can idempotently replace them without touching officer-entered
 * manual adjustments.
 */

/** Bare monetary totals compared between an original and a correction payslip. */
export type PayslipAmountSet = {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export type PayslipDelta = PayslipAmountSet;

export type NetDeltaDirection = "increase" | "decrease" | "none";

/** Category buckets used for line-level correction suggestions. */
export type PayslipCategoryKey =
  | "grossEarnings"
  | "paye"
  | "nisEmployee"
  | "healthSurcharge"
  | "otherDeductions";

export type PayslipCategoryAmounts = Record<PayslipCategoryKey, number>;

export type PayslipCategoryDelta = PayslipCategoryAmounts;

export type SuggestedCorrectionLine = {
  categoryKey: PayslipCategoryKey;
  lineType: "EARNING" | "DEDUCTION";
  code: "CORRECTION_EARNING" | "CORRECTION_DEDUCTION";
  label: string;
  /** Signed amount: positive increases that side of the slip. */
  amount: number;
  isTaxable: boolean;
  notes: string;
};

/** Notes prefix that marks an auto-generated delta line (idempotent replace). */
export const AUTO_DELTA_NOTES_PREFIX = "[auto-delta:";

const STATUTORY_DEDUCTION_LABELS = {
  paye: "PAYE (income tax)",
  nisEmployee: "NIS (employee)",
  healthSurcharge: "Health Surcharge",
} as const;

const CATEGORY_ORDER: PayslipCategoryKey[] = [
  "grossEarnings",
  "paye",
  "nisEmployee",
  "healthSurcharge",
  "otherDeductions",
];

function round(value: number): number {
  return roundToCents(value);
}

function sumLabeledDeductions(
  payslip: PayslipPreview,
  label: string,
): number {
  return round(
    sumMoney(
      ...payslip.deductions
        .filter((line) => line.label === label)
        .map((line) => line.amount),
    ),
  );
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

/**
 * Pull category totals from a payslip preview / frozen snapshot payslip.
 * Statutory lines are matched by exact payslip labels; residual deductions
 * land in `otherDeductions`.
 */
export function extractPayslipCategoryAmounts(
  payslip: PayslipPreview,
): PayslipCategoryAmounts {
  const paye = sumLabeledDeductions(payslip, STATUTORY_DEDUCTION_LABELS.paye);
  const nisEmployee = sumLabeledDeductions(
    payslip,
    STATUTORY_DEDUCTION_LABELS.nisEmployee,
  );
  const healthSurcharge = sumLabeledDeductions(
    payslip,
    STATUTORY_DEDUCTION_LABELS.healthSurcharge,
  );
  const statutoryTotal = sumMoney(paye, nisEmployee, healthSurcharge);
  const otherDeductions = round(payslip.totalDeductions - statutoryTotal);

  return {
    grossEarnings: round(payslip.grossPay),
    paye,
    nisEmployee,
    healthSurcharge,
    otherDeductions,
  };
}

/** Target minus source for each category (cent-rounded). */
export function computeCategoryDeltas(
  target: PayslipCategoryAmounts,
  source: PayslipCategoryAmounts,
): PayslipCategoryDelta {
  return {
    grossEarnings: round(target.grossEarnings - source.grossEarnings),
    paye: round(target.paye - source.paye),
    nisEmployee: round(target.nisEmployee - source.nisEmployee),
    healthSurcharge: round(target.healthSurcharge - source.healthSurcharge),
    otherDeductions: round(target.otherDeductions - source.otherDeductions),
  };
}

export function autoDeltaNotes(categoryKey: PayslipCategoryKey): string {
  return `${AUTO_DELTA_NOTES_PREFIX}${categoryKey}] Auto-generated from source posted snapshot vs current reassembled preview. Replaced on Recalculate.`;
}

export function isAutoGeneratedCorrectionLine(
  notes: string | null | undefined,
): boolean {
  return typeof notes === "string" && notes.startsWith(AUTO_DELTA_NOTES_PREFIX);
}

export function categoryLabelForKey(categoryKey: PayslipCategoryKey): string {
  switch (categoryKey) {
    case "grossEarnings":
      return "Gross earnings correction";
    case "paye":
      return STATUTORY_DEDUCTION_LABELS.paye;
    case "nisEmployee":
      return STATUTORY_DEDUCTION_LABELS.nisEmployee;
    case "healthSurcharge":
      return STATUTORY_DEDUCTION_LABELS.healthSurcharge;
    case "otherDeductions":
      return "Other deductions correction";
  }
}

/**
 * Map non-zero category deltas to suggested CORRECTION_* line items.
 *
 * Gross deltas use CORRECTION_EARNING (signed). Deduction-category deltas use
 * CORRECTION_DEDUCTION (signed: positive = withhold more). Gross correction
 * lines are non-taxable here because PAYE/NIS/Health deltas are emitted as
 * their own lines from the full reassembly comparison — we do not re-run the
 * statutory engine on the delta payment slip.
 */
export function suggestedCorrectionLinesFromCategoryDelta(
  delta: PayslipCategoryDelta,
): SuggestedCorrectionLine[] {
  const lines: SuggestedCorrectionLine[] = [];

  for (const categoryKey of CATEGORY_ORDER) {
    const amount = delta[categoryKey];
    if (amount === 0) {
      continue;
    }

    if (categoryKey === "grossEarnings") {
      lines.push({
        categoryKey,
        lineType: "EARNING",
        code: "CORRECTION_EARNING",
        label: categoryLabelForKey(categoryKey),
        amount,
        isTaxable: false,
        notes: autoDeltaNotes(categoryKey),
      });
      continue;
    }

    lines.push({
      categoryKey,
      lineType: "DEDUCTION",
      code: "CORRECTION_DEDUCTION",
      label: categoryLabelForKey(categoryKey),
      amount,
      isTaxable: false,
      notes: autoDeltaNotes(categoryKey),
    });
  }

  return lines;
}

/**
 * End-to-end: source posted payslip vs target reassembled preview → suggested
 * CORRECTION_* lines. Returns [] when either side is missing or nothing changed.
 */
export function computeSuggestedCorrectionLines(input: {
  sourcePayslip: PayslipPreview | null | undefined;
  targetPayslip: PayslipPreview | null | undefined;
}): SuggestedCorrectionLine[] {
  if (!input.sourcePayslip || !input.targetPayslip) {
    return [];
  }

  const delta = computeCategoryDeltas(
    extractPayslipCategoryAmounts(input.targetPayslip),
    extractPayslipCategoryAmounts(input.sourcePayslip),
  );

  return suggestedCorrectionLinesFromCategoryDelta(delta);
}

export function categoryDirection(
  amount: number,
): NetDeltaDirection {
  if (amount === 0) {
    return "none";
  }
  return amount > 0 ? "increase" : "decrease";
}
