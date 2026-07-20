import { prisma } from "@/lib/prisma";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import type {
  EmployeeTaxProfileStatusCode,
  PersonalAllowanceSourceCode,
  TaxCalculationMethodCode,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";

export type EmployeeTaxProfileRecord = {
  id: string;
  employeeId: string;
  organizationId: string;
  taxYear: number;
  taxCalculationMethod: TaxCalculationMethodCode;
  taxProfileStatus: EmployeeTaxProfileStatusCode;
  personalAllowance: string | null;
  personalAllowanceSource: PersonalAllowanceSourceCode;
  td1Submitted: boolean;
  td1EffectiveDate: string | null;
  td1ApprovedByIrd: boolean;
  td1ApprovalReference: string | null;
  td1OtherApprovedAnnual: string | null;
  td1StoredFileId: string | null;
  cumulativeCalculationEnabled: boolean;
  previousEmploymentDeclared: boolean;
  previousEmploymentVerified: boolean;
  previousEmploymentSource: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  updatedAt: string;
};

function mapTaxProfile(row: {
  id: string;
  employeeId: string;
  organizationId: string;
  taxYear: number;
  taxCalculationMethod: string;
  taxProfileStatus: string;
  personalAllowance: { toString(): string } | null;
  personalAllowanceSource: string;
  td1Submitted: boolean;
  td1EffectiveDate: Date | null;
  td1ApprovedByIrd: boolean;
  td1ApprovalReference: string | null;
  td1OtherApprovedAnnual: { toString(): string } | null;
  td1StoredFileId: string | null;
  cumulativeCalculationEnabled: boolean;
  previousEmploymentDeclared: boolean;
  previousEmploymentVerified: boolean;
  previousEmploymentSource: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
  updatedAt: Date;
}): EmployeeTaxProfileRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    organizationId: row.organizationId,
    taxYear: row.taxYear,
    taxCalculationMethod:
      row.taxCalculationMethod as TaxCalculationMethodCode,
    taxProfileStatus: row.taxProfileStatus as EmployeeTaxProfileStatusCode,
    personalAllowance: row.personalAllowance?.toString() ?? null,
    personalAllowanceSource:
      row.personalAllowanceSource as PersonalAllowanceSourceCode,
    td1Submitted: row.td1Submitted,
    td1EffectiveDate: row.td1EffectiveDate
      ? row.td1EffectiveDate.toISOString().slice(0, 10)
      : null,
    td1ApprovedByIrd: row.td1ApprovedByIrd,
    td1ApprovalReference: row.td1ApprovalReference,
    td1OtherApprovedAnnual: row.td1OtherApprovedAnnual?.toString() ?? null,
    td1StoredFileId: row.td1StoredFileId,
    cumulativeCalculationEnabled: row.cumulativeCalculationEnabled,
    previousEmploymentDeclared: row.previousEmploymentDeclared,
    previousEmploymentVerified: row.previousEmploymentVerified,
    previousEmploymentSource: row.previousEmploymentSource,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo
      ? row.effectiveTo.toISOString().slice(0, 10)
      : null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getEmployeeTaxProfile(
  employeeId: string,
  taxYear?: number,
): Promise<EmployeeTaxProfileRecord | null> {
  const year =
    taxYear ?? taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));

  const row = await prisma.employeeTaxProfile.findUnique({
    where: {
      employeeId_taxYear: {
        employeeId,
        taxYear: year,
      },
    },
  });

  return row ? mapTaxProfile(row) : null;
}

export async function getEmployeeTaxProfileForAsOf(
  employeeId: string,
  asOf: Date | string,
): Promise<EmployeeTaxProfileRecord | null> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  return getEmployeeTaxProfile(employeeId, taxYearFromAsOfKey(asOfKey));
}
