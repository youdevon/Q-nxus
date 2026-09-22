"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import type {
  OtherEmolumentIncomeStatusCode,
  PersonalAllowanceSourceCode,
  PreviousEmploymentStatusCode,
  TaxCalculationMethodCode,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";
import { taxYearFromAsOfKey, toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";

export type EmployeeTaxProfileFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

const TAX_METHODS: TaxCalculationMethodCode[] = [
  "STANDARD_CUMULATIVE",
  "STANDARD_NON_CUMULATIVE",
  "PREVIOUS_INCOME_INCLUDED",
  "MANUAL_INSTRUCTION",
  "SPECIAL_IRD_INSTRUCTION",
];

const ALLOWANCE_SOURCES: PersonalAllowanceSourceCode[] = [
  "STATUTORY_DEFAULT",
  "TD1",
  "IRD_INSTRUCTION",
  "MANUAL_AUTHORIZED",
];

const PREVIOUS_EMPLOYMENT_STATUSES: PreviousEmploymentStatusCode[] = [
  "NO_PREVIOUS_EMPLOYMENT",
  "PREVIOUS_EMPLOYMENT",
  "UNKNOWN_PREVIOUS_INCOME",
];

const OTHER_EMOLUMENT_STATUSES: OtherEmolumentIncomeStatusCode[] = [
  "NO_OTHER_EMOLUMENTS",
  "HAS_OTHER_EMOLUMENTS",
  "UNKNOWN_OTHER_EMOLUMENTS",
];

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNonNegative(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
): number | null {
  if (!value) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }
  return amount;
}

export async function saveEmployeeTaxProfile(
  _previousState: EmployeeTaxProfileFormState,
  formData: FormData,
): Promise<EmployeeTaxProfileFormState> {
  const actor = await requireActor(
    "payroll.tax_profile.manage",
    "payroll.setup",
    "payroll.manage",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  if (!employeeId) {
    return { status: "error", message: "Missing employee reference." };
  }

  const fieldErrors: Record<string, string> = {};
  const currentYear = taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const taxYearRaw = textValue(formData, "taxYear");
  const taxYear = taxYearRaw ? Number(taxYearRaw) : currentYear;

  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    fieldErrors.taxYear = "Enter a valid tax year.";
  }

  const methodRaw = textValue(formData, "taxCalculationMethod");
  const taxCalculationMethod = TAX_METHODS.includes(
    methodRaw as TaxCalculationMethodCode,
  )
    ? (methodRaw as TaxCalculationMethodCode)
    : null;

  if (!taxCalculationMethod) {
    fieldErrors.taxCalculationMethod = "Select a tax calculation method.";
  }

  const sourceRaw = textValue(formData, "personalAllowanceSource");
  const personalAllowanceSource = ALLOWANCE_SOURCES.includes(
    sourceRaw as PersonalAllowanceSourceCode,
  )
    ? (sourceRaw as PersonalAllowanceSourceCode)
    : "STATUTORY_DEFAULT";

  const previousStatusRaw = textValue(formData, "previousEmploymentStatus");
  const previousEmploymentStatus = PREVIOUS_EMPLOYMENT_STATUSES.includes(
    previousStatusRaw as PreviousEmploymentStatusCode,
  )
    ? (previousStatusRaw as PreviousEmploymentStatusCode)
    : null;

  if (!previousEmploymentStatus) {
    fieldErrors.previousEmploymentStatus =
      "Select previous employment status for this tax year.";
  }

  const otherEmolumentRaw = textValue(formData, "otherEmolumentIncomeStatus");
  const otherEmolumentIncomeStatus = OTHER_EMOLUMENT_STATUSES.includes(
    otherEmolumentRaw as OtherEmolumentIncomeStatusCode,
  )
    ? (otherEmolumentRaw as OtherEmolumentIncomeStatusCode)
    : "UNKNOWN_OTHER_EMOLUMENTS";

  const personalAllowance = parseNonNegative(
    textValue(formData, "personalAllowance"),
    "personalAllowance",
    fieldErrors,
  );
  const td1OtherApprovedAnnual = parseNonNegative(
    textValue(formData, "td1OtherApprovedAnnual"),
    "td1OtherApprovedAnnual",
    fieldErrors,
  );

  const td1EffectiveRaw = textValue(formData, "td1EffectiveDate");
  let td1EffectiveDate: Date | null = null;
  if (td1EffectiveRaw) {
    td1EffectiveDate = parseDate(td1EffectiveRaw);
    if (!td1EffectiveDate) {
      fieldErrors.td1EffectiveDate = "Use YYYY-MM-DD.";
    }
  }

  const td1Submitted = formData.get("td1Submitted") === "on";
  const td1ApprovedByIrd = formData.get("td1ApprovedByIrd") === "on";
  const cumulativeCalculationEnabled =
    formData.get("cumulativeCalculationEnabled") === "on" ||
    taxCalculationMethod === "STANDARD_CUMULATIVE";
  const previousEmploymentDeclared =
    previousEmploymentStatus === "PREVIOUS_EMPLOYMENT";
  const previousEmploymentVerified =
    formData.get("previousEmploymentVerified") === "on";
  const birDirectionPresent = formData.get("birDirectionPresent") === "on";
  const birDirectionReference = nullableText(formData, "birDirectionReference");
  const td1ApprovalReference = nullableText(formData, "td1ApprovalReference");
  const previousEmploymentSource = nullableText(
    formData,
    "previousEmploymentSource",
  );
  const notes = nullableText(formData, "notes");

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the tax profile information.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const effectiveFrom = new Date(Date.UTC(taxYear, 0, 1));
  const td1Decimal =
    td1OtherApprovedAnnual == null
      ? null
      : new Prisma.Decimal(td1OtherApprovedAnnual.toFixed(2));
  const allowanceDecimal =
    personalAllowance == null
      ? null
      : new Prisma.Decimal(personalAllowance.toFixed(2));

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      const profile = await transaction.employeeTaxProfile.upsert({
        where: {
          employeeId_taxYear: {
            employeeId: employee.id,
            taxYear,
          },
        },
        create: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          taxYear,
          taxCalculationMethod: taxCalculationMethod!,
          taxProfileStatus: "ACTIVE",
          personalAllowance: allowanceDecimal,
          personalAllowanceSource,
          td1Submitted,
          td1EffectiveDate,
          td1ApprovedByIrd,
          td1ApprovalReference,
          td1OtherApprovedAnnual: td1Decimal,
          cumulativeCalculationEnabled,
          previousEmploymentStatus: previousEmploymentStatus!,
          previousEmploymentDeclared,
          previousEmploymentVerified,
          previousEmploymentSource,
          otherEmolumentIncomeStatus,
          birDirectionPresent,
          birDirectionReference,
          effectiveFrom,
          notes,
          createdByUserId: actor.actor.userId,
          updatedByUserId: actor.actor.userId,
        },
        update: {
          taxCalculationMethod: taxCalculationMethod!,
          personalAllowance: allowanceDecimal,
          personalAllowanceSource,
          td1Submitted,
          td1EffectiveDate,
          td1ApprovedByIrd,
          td1ApprovalReference,
          td1OtherApprovedAnnual: td1Decimal,
          cumulativeCalculationEnabled,
          previousEmploymentStatus: previousEmploymentStatus!,
          previousEmploymentDeclared,
          previousEmploymentVerified,
          previousEmploymentSource,
          otherEmolumentIncomeStatus,
          birDirectionPresent,
          birDirectionReference,
          notes,
          updatedByUserId: actor.actor.userId,
        },
        select: { id: true },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeTaxProfile",
        entityId: profile.id,
        description: `Updated ${taxYear} tax profile for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,
        newValues: {
          taxYear,
          taxCalculationMethod,
          personalAllowance,
          personalAllowanceSource,
          td1Submitted,
          td1ApprovedByIrd,
          td1OtherApprovedAnnual,
          cumulativeCalculationEnabled,
          previousEmploymentStatus,
          previousEmploymentDeclared,
          previousEmploymentVerified,
          otherEmolumentIncomeStatus,
          birDirectionPresent,
        },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to save employee tax profile:", error);
    return {
      status: "error",
      message: "Unable to save the tax profile. Try again.",
    };
  }

  revalidatePath(`/payroll/employees/${employee.id}`);
  revalidatePath(`/people/employees/${employee.id}`);
  revalidatePath("/payroll");

  return {
    status: "success",
    message: `Tax profile for ${taxYear} saved.`,
  };
}
