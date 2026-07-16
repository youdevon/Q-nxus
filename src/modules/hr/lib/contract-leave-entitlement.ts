import { inclusiveContractMonths } from "@/src/modules/hr/services/calculate-contract-gratuity";

const MONTHS_PER_YEAR = 12;

function roundLeaveQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Pure day count for contract-period leave entitlement (client + server). */
export function calculateContractLeaveEntitlementDays({
  annualEntitlement,
  contractStart,
  contractEnd,
  prorate,
}: {
  annualEntitlement: number | string;
  contractStart: Date;
  contractEnd: Date;
  prorate: boolean;
}): number {
  const annual = Number(annualEntitlement);

  if (!Number.isFinite(annual) || annual < 0) {
    throw new Error(
      "Annual leave entitlement must be a valid non-negative number.",
    );
  }

  if (!prorate) {
    return roundLeaveQuantity(annual);
  }

  const contractMonths = inclusiveContractMonths(contractStart, contractEnd);

  const entitlement =
    (annual * Math.min(contractMonths, MONTHS_PER_YEAR)) / MONTHS_PER_YEAR;

  return roundLeaveQuantity(entitlement);
}
