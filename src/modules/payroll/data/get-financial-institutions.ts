import { prisma } from "@/lib/prisma";
import type { FinancialInstitutionOption } from "@/src/modules/payroll/lib/payroll-setup-types";

export type FinancialInstitutionRecord = FinancialInstitutionOption & {
  legalName: string;
  countryCode: string;
  currencyCode: string;
  supportsPayrollDeposits: boolean;
  supportsAchDebits: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export async function getFinancialInstitutions(options?: {
  selectableOnly?: boolean;
  activeOnly?: boolean;
}): Promise<FinancialInstitutionRecord[]> {
  const rows = await prisma.financialInstitution.findMany({
    where: {
      ...(options?.selectableOnly ? { isSelectableForEmployees: true } : {}),
      ...(options?.activeOnly ? { isActive: true, archivedAt: null } : {}),
    },
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
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));
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
