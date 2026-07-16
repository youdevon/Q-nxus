import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { prisma } from "@/lib/prisma";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import { getCurrentNisClasses } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { toHealthConfigInput } from "@/src/modules/payroll/lib/health-surcharge";
import { toNisClassInputs } from "@/src/modules/payroll/lib/nis-contribution";
import { toPayeConfigInput } from "@/src/modules/payroll/lib/paye-contribution";
import {
  assemblePayslipPreview,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";

export type { PayslipPreview };

/** Presentation metadata for the payslip document (not used in calculations). */
export type PayslipDocumentMeta = {
  organizationName: string;
  jobTitle: string | null;
  departmentName: string | null;
};

export type EmployeePayslipPreviewResult = {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
};

/**
 * Build a monthly payslip preview for an employee using current statutory
 * configs and the current contract pay elements.
 */
export async function getEmployeePayslipPreview(
  employeeId: string,
  options?: { asOf?: Date },
): Promise<EmployeePayslipPreviewResult | null> {
  const setup = await getEmployeePayrollSetup(employeeId);

  if (!setup) {
    return null;
  }

  const [nisClasses, payeConfig, healthConfig, organization, employeeExtras] =
    await Promise.all([
      getCurrentNisClasses(),
      getCurrentPayeTaxConfig(),
      getCurrentHealthSurchargeConfig(),
      getOrganizationProfile(),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          department: {
            select: { name: true },
          },
        },
      }),
    ]);

  const payslip = assemblePayslipPreview({
    employee: {
      id: setup.employee.id,
      employeeNumber: setup.employee.employeeNumber,
      displayName: setup.employee.displayName,
      dateOfBirth: setup.employee.dateOfBirth,
      nisNumber: setup.profile?.nisNumber ?? null,
      birNumber: setup.profile?.birNumber ?? null,
    },
    currency:
      setup.currentContract?.currency ??
      setup.payElements[0]?.currency ??
      "TTD",
    payFrequency: setup.profile?.payFrequency ?? "MONTHLY",
    paymentMethod: setup.profile?.paymentMethod ?? "BANK_TRANSFER",
    asOf: options?.asOf,
    earnings: setup.payElements.map((element) => ({
      label: element.label,
      amount: Number(element.amount),
      frequency: element.frequency,
      isTaxable: element.isTaxable,
      source: element.source,
    })),
    bankAccounts: setup.bankAccounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.amount != null ? Number(account.amount) : null,
      isPrimary: account.isPrimary,
    })),
    readiness: setup.readiness,
    td1OtherApprovedAnnual:
      setup.profile?.td1OtherApprovedAnnual != null
        ? Number(setup.profile.td1OtherApprovedAnnual)
        : 0,
    pensionOnlyIncome: setup.profile?.pensionOnlyIncome ?? false,
    nisClasses: toNisClassInputs(nisClasses),
    payeConfig: payeConfig != null ? toPayeConfigInput(payeConfig) : null,
    healthConfig:
      healthConfig != null ? toHealthConfigInput(healthConfig) : null,
  });

  return {
    payslip,
    meta: {
      organizationName:
        organization?.legalName?.trim() ||
        organization?.name?.trim() ||
        "Organization",
      jobTitle: setup.currentContract?.jobTitle ?? null,
      departmentName: employeeExtras?.department?.name ?? null,
    },
  };
}
