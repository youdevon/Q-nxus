/**
 * Prior-employer calendar-year YTD aggregation (Phase 3).
 * Totals are stored for mid-year joiners; cumulative PAYE applies them in Phase 4.
 */

export type PriorEmploymentYtdAmounts = {
  taxableIncomeYtd: number;
  payeDeductedYtd: number;
  nisEmployeeYtd: number;
  nisEmployerYtd: number;
  healthSurchargeYtd: number;
  otherApprovedDeductionsYtd: number;
  verified: boolean;
};

export type PriorEmploymentYtdTotals = {
  taxableIncomeYtd: number;
  payeDeductedYtd: number;
  nisEmployeeYtd: number;
  nisEmployerYtd: number;
  healthSurchargeYtd: number;
  otherApprovedDeductionsYtd: number;
  recordCount: number;
  verifiedCount: number;
  allVerified: boolean;
};

export function emptyPriorEmploymentYtdTotals(): PriorEmploymentYtdTotals {
  return {
    taxableIncomeYtd: 0,
    payeDeductedYtd: 0,
    nisEmployeeYtd: 0,
    nisEmployerYtd: 0,
    healthSurchargeYtd: 0,
    otherApprovedDeductionsYtd: 0,
    recordCount: 0,
    verifiedCount: 0,
    allVerified: true,
  };
}

function nonNegative(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

/** Sum ACTIVE prior-employer YTD rows for a tax year. */
export function aggregatePriorEmploymentYtd(
  records: PriorEmploymentYtdAmounts[],
  options?: { verifiedOnly?: boolean },
): PriorEmploymentYtdTotals {
  const selected = options?.verifiedOnly
    ? records.filter((row) => row.verified)
    : records;

  if (selected.length === 0) {
    return emptyPriorEmploymentYtdTotals();
  }

  let taxableIncomeYtd = 0;
  let payeDeductedYtd = 0;
  let nisEmployeeYtd = 0;
  let nisEmployerYtd = 0;
  let healthSurchargeYtd = 0;
  let otherApprovedDeductionsYtd = 0;
  let verifiedCount = 0;

  for (const row of selected) {
    taxableIncomeYtd += nonNegative(row.taxableIncomeYtd);
    payeDeductedYtd += nonNegative(row.payeDeductedYtd);
    nisEmployeeYtd += nonNegative(row.nisEmployeeYtd);
    nisEmployerYtd += nonNegative(row.nisEmployerYtd);
    healthSurchargeYtd += nonNegative(row.healthSurchargeYtd);
    otherApprovedDeductionsYtd += nonNegative(row.otherApprovedDeductionsYtd);
    if (row.verified) {
      verifiedCount += 1;
    }
  }

  return {
    taxableIncomeYtd: round2(taxableIncomeYtd),
    payeDeductedYtd: round2(payeDeductedYtd),
    nisEmployeeYtd: round2(nisEmployeeYtd),
    nisEmployerYtd: round2(nisEmployerYtd),
    healthSurchargeYtd: round2(healthSurchargeYtd),
    otherApprovedDeductionsYtd: round2(otherApprovedDeductionsYtd),
    recordCount: selected.length,
    verifiedCount,
    allVerified: verifiedCount === selected.length,
  };
}

/**
 * Totals that may enter approved / applied PAYE (verified ACTIVE rows only).
 * Unverified rows remain visible for preview warnings but are excluded here.
 */
export function aggregateVerifiedPriorEmploymentYtd(
  records: PriorEmploymentYtdAmounts[],
): PriorEmploymentYtdTotals {
  return aggregatePriorEmploymentYtd(records, { verifiedOnly: true });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priorEmploymentCalcNotes(input: {
  previousEmploymentDeclared: boolean;
  taxCalculationMethodIncludesPrevious: boolean;
  totals: PriorEmploymentYtdTotals;
}): string[] {
  const notes: string[] = [];
  const hasRecords = input.totals.recordCount > 0;
  const wantsPrevious =
    input.previousEmploymentDeclared ||
    input.taxCalculationMethodIncludesPrevious;

  if (!wantsPrevious && !hasRecords) {
    return notes;
  }

  if (wantsPrevious && !hasRecords) {
    notes.push(
      "Previous employment declared but no prior-employer YTD records — join without prior payslip is allowed; enter YTD when available.",
    );
    return notes;
  }

  const verifiedLabel = input.totals.allVerified
    ? "all verified"
    : `${input.totals.verifiedCount}/${input.totals.recordCount} verified`;

  notes.push(
    `Prior-employer YTD on file (${input.totals.recordCount} record${input.totals.recordCount === 1 ? "" : "s"}, ${verifiedLabel}): taxable ${input.totals.taxableIncomeYtd.toFixed(2)}, PAYE paid ${input.totals.payeDeductedYtd.toFixed(2)}.`,
  );

  return notes;
}
