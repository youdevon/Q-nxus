/**
 * Seed-only account-length defaults keyed by TT ACH routing.
 * Runtime allowlist is FinancialInstitution (DB) — never use this as a live gate.
 * Applied when seeding / when DB min/max columns are null.
 */

export type AchAccountLengthDefault = {
  routing: string;
  min: number;
  max: number;
  note: string;
};

/** Defaults matching known-good FCB / commercial bank account shapes. */
export const FCB_TT_ACH_ACCOUNT_LENGTH_BY_ROUTING: ReadonlyMap<
  string,
  AchAccountLengthDefault
> = new Map(
  [
    {
      routing: "010100013",
      min: 1,
      max: 17,
      note: "Short numbers (e.g. 7 digits) are valid.",
    },
    {
      routing: "010100903",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
    {
      routing: "010100039",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
    {
      routing: "010100026",
      min: 12,
      max: 14,
      note: "Expected 12–14 digits (5-digit branch transit + zero-padded account).",
    },
    {
      routing: "010100602",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
    {
      routing: "010100505",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
    {
      routing: "010100055",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
    {
      routing: "010100107",
      min: 7,
      max: 17,
      note: "Flag unusual lengths outside 7–17.",
    },
  ].map((row) => [row.routing, row]),
);

export function defaultAchAccountLength(routing: string): AchAccountLengthDefault {
  const digits = routing.replace(/\D/g, "");
  return (
    FCB_TT_ACH_ACCOUNT_LENGTH_BY_ROUTING.get(digits) ?? {
      routing: digits,
      min: 7,
      max: 17,
      note: "Expected 7–17 digits.",
    }
  );
}
