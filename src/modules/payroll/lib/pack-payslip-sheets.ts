/**
 * Pack payslips onto Letter sheets: prefer up to 3 when they fit in print
 * height, otherwise 2 or 1. Never splits a single payslip across pages.
 *
 * Heights are estimated for the *print-compact* layout (not on-screen
 * typography). Measuring screen DOM heights against Letter printable area
 * incorrectly forced 1-per-sheet for almost every slip.
 */

export const PAYSLIP_BATCH_MAX_PER_SHEET = 3;

/** Relative units for one Letter printable area (portrait, 0.5in margins). */
export const LETTER_SHEET_UNITS = 100;

/** Space reserved between slips on the same sheet (cut guide). */
export const PAYSLIP_GUIDE_UNITS = 2;

/**
 * Print-compact chrome: header, meta grids, gross, net.
 * Tuned so a typical statutory slip (≈3 deduction lines, no extra earnings)
 * packs three-to-a-page; YTD or many lines drop to two; very dense to one.
 */
const PRINT_CHROME_UNITS = 24;
const PRINT_LINE_UNITS = 2;
const PRINT_YTD_UNITS = 6;

export function estimatePayslipPrintUnits(input: {
  /** Earnings rows shown below meta allowances (overtime, etc.). */
  extraEarningLines: number;
  /** Employee deduction rows (NIS / PAYE / Health / other; not bank transfers). */
  deductionLines: number;
  hasYtd: boolean;
}): number {
  const lines =
    Math.max(0, input.extraEarningLines) + Math.max(0, input.deductionLines);
  return (
    PRINT_CHROME_UNITS +
    PRINT_LINE_UNITS * lines +
    (input.hasYtd ? PRINT_YTD_UNITS : 0)
  );
}

export function packPayslipHeights(input: {
  heights: readonly number[];
  availableHeight: number;
  guideHeight: number;
  maxPerSheet?: number;
}): number[][] {
  const maxPerSheet = input.maxPerSheet ?? PAYSLIP_BATCH_MAX_PER_SHEET;
  const sheets: number[][] = [];
  let current: number[] = [];
  let used = 0;

  for (let index = 0; index < input.heights.length; index += 1) {
    const height = Math.max(0, input.heights[index] ?? 0);
    const guide = current.length > 0 ? input.guideHeight : 0;
    const nextUsed = used + guide + height;
    const wouldOverflow =
      current.length > 0 && nextUsed > input.availableHeight + 0.5;
    const atCap = current.length >= maxPerSheet;

    if (atCap || wouldOverflow) {
      sheets.push(current);
      current = [index];
      used = height;
      continue;
    }

    current.push(index);
    used = nextUsed;
  }

  if (current.length > 0) {
    sheets.push(current);
  }

  return sheets;
}

export function packPayslipPrintUnits(
  units: readonly number[],
  options?: {
    availableUnits?: number;
    guideUnits?: number;
    maxPerSheet?: number;
  },
): number[][] {
  return packPayslipHeights({
    heights: units,
    availableHeight: options?.availableUnits ?? LETTER_SHEET_UNITS,
    guideHeight: options?.guideUnits ?? PAYSLIP_GUIDE_UNITS,
    maxPerSheet: options?.maxPerSheet,
  });
}

/** Summarize packing for toolbar copy (e.g. "3+2+3"). */
export function summarizePayslipPacking(sheets: readonly number[][]): {
  sheetCount: number;
  maxOnSheet: number;
  packingLabel: string;
} {
  const counts = sheets.map((sheet) => sheet.length);
  const maxOnSheet = counts.reduce((max, count) => Math.max(max, count), 0);
  return {
    sheetCount: sheets.length,
    maxOnSheet,
    packingLabel: counts.join("+") || "0",
  };
}
