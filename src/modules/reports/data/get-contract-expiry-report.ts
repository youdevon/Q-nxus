import {
  getContractMonitoringDashboard,
  type ContractMonitoringRecord,
} from "@/src/modules/hr/data/get-employment-contracts";
import {
  buildContractExpirySummary,
  contractMatchesExpiryWindow,
  isContractExpiryCandidate,
  parseContractExpiryWindow,
  type ContractExpiryWindow,
} from "@/src/modules/reports/lib/contract-expiry-filters";

export type { ContractExpiryWindow } from "@/src/modules/reports/lib/contract-expiry-filters";
export {
  contractMatchesExpiryWindow,
  isContractExpiryCandidate,
  parseContractExpiryWindow,
} from "@/src/modules/reports/lib/contract-expiry-filters";

export type ContractExpiryReportRow = ContractMonitoringRecord;

export type ContractExpiryReport = {
  window: ContractExpiryWindow;
  rows: ContractExpiryReportRow[];
  summary: ReturnType<typeof buildContractExpirySummary>;
};

/** Current employment contracts with end dates, filtered by expiry window. */
export async function getContractExpiryReport(input?: {
  window?: string;
}): Promise<ContractExpiryReport> {
  const window = parseContractExpiryWindow(input?.window);
  const dashboard = await getContractMonitoringDashboard();
  const summary = buildContractExpirySummary(dashboard.contracts);

  const rows = dashboard.contracts.filter(
    (contract) =>
      isContractExpiryCandidate(contract) &&
      contractMatchesExpiryWindow(contract, window),
  );

  return { window, rows, summary };
}
