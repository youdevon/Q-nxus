import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { FinancialInstitutionOption } from "@/src/modules/payroll/lib/payroll-setup-types";

export type FinancialInstitutionRecord = FinancialInstitutionOption & {
  legalName: string;
  countryCode: string;
  currencyCode: string;
  supportsPayrollDeposits: boolean;
  supportsAchDebits: boolean;
  accountNumberMinLength: number | null;
  accountNumberMaxLength: number | null;
  localInstitutionCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

type ListOptions = {
  selectableOnly?: boolean;
  activeOnly?: boolean;
};

/**
 * One DB read per request for the full institution directory.
 * Filtered views reuse this list in memory (no duplicate queries).
 */
const loadAllFinancialInstitutions = cache(
  async (): Promise<FinancialInstitutionRecord[]> => {
    const rows = await prisma.financialInstitution.findMany({
      orderBy: [{ institutionType: "asc" }, { displayName: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      catalogKey: row.catalogKey,
      legalName: row.legalName,
      displayName: row.displayName,
      shortName: row.shortName,
      institutionType: row.institutionType,
      countryCode: row.countryCode,
      currencyCode: row.currencyCode,
      isActive: row.isActive,
      isSelectableForEmployees: row.isSelectableForEmployees,
      supportsPayrollDeposits: row.supportsPayrollDeposits,
      supportsAchCredits: row.supportsAchCredits,
      supportsAchDebits: row.supportsAchDebits,
      routingCode: row.routingCode,
      achParticipantCode: row.achParticipantCode,
      accountNumberMinLength: row.accountNumberMinLength,
      accountNumberMaxLength: row.accountNumberMaxLength,
      localInstitutionCode: row.localInstitutionCode,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
);

/**
 * Shared financial institution directory (single DB source of truth).
 */
export async function getFinancialInstitutions(
  options?: ListOptions,
): Promise<FinancialInstitutionRecord[]> {
  let rows = await loadAllFinancialInstitutions();
  if (options?.activeOnly) {
    rows = rows.filter((row) => row.isActive && row.archivedAt == null);
  }
  if (options?.selectableOnly) {
    rows = rows.filter((row) => row.isSelectableForEmployees);
  }
  return rows;
}

export async function getSelectableFinancialInstitutionOptions(): Promise<
  FinancialInstitutionOption[]
> {
  const rows = await getFinancialInstitutions({
    selectableOnly: true,
    activeOnly: true,
  });

  return rows.map((row) => ({
    id: row.id,
    catalogKey: row.catalogKey,
    displayName: row.displayName,
    shortName: row.shortName,
    institutionType: row.institutionType,
    isActive: row.isActive,
    isSelectableForEmployees: row.isSelectableForEmployees,
    supportsAchCredits: row.supportsAchCredits,
    routingCode: row.routingCode,
    achParticipantCode: row.achParticipantCode,
  }));
}
