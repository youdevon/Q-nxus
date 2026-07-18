/**
 * Payroll money helpers — integer cents for arithmetic, decimal currency at boundaries.
 *
 * Rounding policy: half-away-from-zero via Math.round (matches prior roundMoney).
 * Public payslip APIs remain currency units as number (2 d.p.).
 */

/** Convert a currency amount to integer cents. Non-finite → 0. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100);
}

/** Convert integer cents to a currency amount. */
export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) {
    return 0;
  }
  return cents / 100;
}

/** Round a currency amount to 2 decimal places (cent boundary). */
export function roundToCents(value: number): number {
  return fromCents(toCents(value));
}

export function addCents(...parts: number[]): number {
  let total = 0;
  for (const part of parts) {
    total += Number.isFinite(part) ? Math.trunc(part) : 0;
  }
  return total;
}

export function subCents(left: number, right: number): number {
  return (
    (Number.isFinite(left) ? Math.trunc(left) : 0) -
    (Number.isFinite(right) ? Math.trunc(right) : 0)
  );
}

/**
 * Multiply cents by a rate (e.g. tax %), rounding to the nearest cent once.
 */
export function mulCentsRate(cents: number, rate: number): number {
  if (!Number.isFinite(cents) || !Number.isFinite(rate)) {
    return 0;
  }
  return Math.round(Math.trunc(cents) * rate);
}

/** Sum currency amounts via cents (exact for 2-d.p. inputs). */
export function sumMoney(...amounts: number[]): number {
  return fromCents(addCents(...amounts.map(toCents)));
}

/**
 * Assert that a run total equals the sum of employee amounts (cent-exact).
 * Returns the difference in cents (0 = match).
 */
export function moneyDiffCents(expected: number, actual: number): number {
  return subCents(toCents(expected), toCents(actual));
}
