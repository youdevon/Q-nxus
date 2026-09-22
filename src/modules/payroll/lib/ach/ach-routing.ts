/**
 * NACHA ABA check digit (3-7-1 weighting) + TT ACH participant gate.
 *
 * Known banks come only from FinancialInstitution via getAchParticipantBanks().
 * Pass that registry in production. Without a registry, only structure (9 digits
 * + check digit) is validated — the known-bank gate requires the registry.
 */

import { digitsOnly } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import type { AchParticipantBank } from "@/src/modules/payroll/lib/ach/ach-participant-types";

const WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1] as const;

/** Compute the check digit for the first 8 ABA digits (0–9). */
export function computeNachaCheckDigit(routingWithoutCheck: string): number {
  const digits = digitsOnly(routingWithoutCheck);
  if (digits.length !== 8) {
    throw new Error("Routing without check digit must be exactly 8 digits.");
  }
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += Number(digits[i]) * WEIGHTS[i]!;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/** True when the 9-digit routing's 9th digit matches 3-7-1. */
export function isValidNachaCheckDigit(routing: string): boolean {
  const digits = digitsOnly(routing);
  if (digits.length !== 9) {
    return false;
  }
  const expected = computeNachaCheckDigit(digits.slice(0, 8));
  return Number(digits[8]) === expected;
}

export type AchRoutingParticipant = {
  id: string;
  name: string;
  shortName: string;
  routing: string;
  accountDigits: { min: number; max: number; note: string };
};

export type AchRoutingValidation =
  | {
      ok: true;
      routing: string;
      participant: AchRoutingParticipant;
    }
  | {
      ok: false;
      routing: string | null;
      error: string;
    };

function toParticipant(
  bank: AchParticipantBank | AchRoutingParticipant,
): AchRoutingParticipant {
  return {
    id: bank.id,
    name: bank.name,
    shortName: bank.shortName,
    routing: bank.routing,
    accountDigits: bank.accountDigits,
  };
}

function asParticipantMap(
  registry:
    | ReadonlyMap<string, AchRoutingParticipant | AchParticipantBank>
    | readonly (AchRoutingParticipant | AchParticipantBank)[],
): Map<string, AchRoutingParticipant | AchParticipantBank> {
  if ("get" in registry && typeof registry.get === "function") {
    return new Map(registry as ReadonlyMap<string, AchRoutingParticipant | AchParticipantBank>);
  }
  return new Map(
    [...(registry as Iterable<AchRoutingParticipant | AchParticipantBank>)].map(
      (bank) => [bank.routing, bank],
    ),
  );
}

/**
 * Validate routing: 9 digits + 3-7-1 check digit.
 * When `registry` is provided, routing must also be an enabled ACH participant.
 */
export function validateFcbTtAchRouting(
  value: string | null | undefined,
  registry?:
    | ReadonlyMap<string, AchRoutingParticipant | AchParticipantBank>
    | readonly (AchRoutingParticipant | AchParticipantBank)[],
): AchRoutingValidation {
  const digits = digitsOnly(value ?? "");
  if (digits.length !== 9) {
    return {
      ok: false,
      routing: digits || null,
      error: "ACH routing number must be exactly 9 digits.",
    };
  }
  if (!isValidNachaCheckDigit(digits)) {
    return {
      ok: false,
      routing: digits,
      error: `Routing ${digits} fails the NACHA 3-7-1 check digit.`,
    };
  }

  if (registry == null) {
    // Structure-only (tests / internal); production paths always pass DB registry.
    return {
      ok: true,
      routing: digits,
      participant: {
        id: digits,
        name: "Unknown",
        shortName: "Unknown",
        routing: digits,
        accountDigits: { min: 7, max: 17, note: "Expected 7–17 digits." },
      },
    };
  }

  const map = asParticipantMap(registry);
  const found = map.get(digits);
  if (!found) {
    return {
      ok: false,
      routing: digits,
      error: `Routing ${digits} is not an enabled Trinidad & Tobago ACH participant bank. Add or enable it under Payroll Settings → ACH banks.`,
    };
  }

  return { ok: true, routing: digits, participant: toParticipant(found) };
}
