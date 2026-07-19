/**
 * Numbering sequences store `currentNumber` as the last issued value.
 * The next allocated reference uses `currentNumber + 1`.
 * Resetting to zero sets `currentNumber` to 0 so the next issued value is 1.
 */

export type SequenceFormatInput = {
  value: bigint | number | string;
  minimumLength: number;
  prefix?: string | null;
  suffix?: string | null;
};

export function parseNonNegativeBigInt(value: string): bigint | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return BigInt(trimmed);
}

/** Last issued counter → next number that will be allocated. */
export function nextNumberFromCurrent(currentNumber: bigint): bigint {
  return currentNumber + BigInt(1);
}

/**
 * Admin "next number" → stored `currentNumber`.
 * Next must be at least 1 (so a reset to zero yields next = 1).
 */
export function currentNumberFromNextNumber(nextNumber: bigint): bigint {
  if (nextNumber < BigInt(1)) {
    throw new Error("Next number must be at least 1.");
  }

  return nextNumber - BigInt(1);
}

export function formatSequenceReference(input: SequenceFormatInput): string {
  const numberPart = BigInt(input.value)
    .toString()
    .padStart(input.minimumLength, "0");

  return `${input.prefix ?? ""}${numberPart}${input.suffix ?? ""}`;
}

export function previewNextReference(input: {
  currentNumber: bigint | number | string;
  minimumLength: number;
  prefix?: string | null;
  suffix?: string | null;
}): string {
  return formatSequenceReference({
    value: nextNumberFromCurrent(BigInt(input.currentNumber)),
    minimumLength: input.minimumLength,
    prefix: input.prefix,
    suffix: input.suffix,
  });
}
