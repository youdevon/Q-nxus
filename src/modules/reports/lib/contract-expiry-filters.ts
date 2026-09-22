import type { ContractMonitoringRecord } from "@/src/modules/hr/data/get-employment-contracts";

export type ContractExpiryWindow = "30" | "60" | "90" | "all";

const WINDOW_CATEGORIES: Record<
  Exclude<ContractExpiryWindow, "all">,
  ContractMonitoringRecord["expiryCategory"][]
> = {
  "30": ["WITHIN_30_DAYS", "EXPIRED"],
  "60": ["WITHIN_30_DAYS", "WITHIN_60_DAYS", "EXPIRED"],
  "90": [
    "WITHIN_30_DAYS",
    "WITHIN_60_DAYS",
    "WITHIN_90_DAYS",
    "EXPIRED",
  ],
};

const EXPIRY_REPORT_STATUSES = new Set(["ACTIVE", "EXPIRED"]);

export function parseContractExpiryWindow(
  value: string | undefined,
): ContractExpiryWindow {
  if (value === "30" || value === "60" || value === "90" || value === "all") {
    return value;
  }
  return "all";
}

/** Current (or recently expired) contracts with an end date — same scope as contract monitoring. */
export function isContractExpiryCandidate(
  contract: ContractMonitoringRecord,
): boolean {
  if (contract.expiryCategory === "NO_END_DATE") {
    return false;
  }

  if (!contract.isCurrent && contract.expiryCategory !== "EXPIRED") {
    return false;
  }

  if (!EXPIRY_REPORT_STATUSES.has(contract.status)) {
    return false;
  }

  return true;
}

export function contractMatchesExpiryWindow(
  contract: ContractMonitoringRecord,
  window: ContractExpiryWindow,
): boolean {
  if (window === "all") {
    return contract.expiryCategory !== "NO_END_DATE";
  }

  return WINDOW_CATEGORIES[window].includes(contract.expiryCategory);
}

export function buildContractExpirySummary(
  contracts: ContractMonitoringRecord[],
) {
  const candidates = contracts.filter(isContractExpiryCandidate);

  return {
    totalWithEndDate: candidates.length,
    within30Days: candidates.filter(
      (contract) =>
        contract.expiryCategory === "WITHIN_30_DAYS" ||
        contract.expiryCategory === "EXPIRED",
    ).length,
    within60Days: candidates.filter((contract) =>
      ["WITHIN_30_DAYS", "WITHIN_60_DAYS", "EXPIRED"].includes(
        contract.expiryCategory,
      ),
    ).length,
    within90Days: candidates.filter((contract) =>
      [
        "WITHIN_30_DAYS",
        "WITHIN_60_DAYS",
        "WITHIN_90_DAYS",
        "EXPIRED",
      ].includes(contract.expiryCategory),
    ).length,
    expired: candidates.filter(
      (contract) => contract.expiryCategory === "EXPIRED",
    ).length,
  };
}
