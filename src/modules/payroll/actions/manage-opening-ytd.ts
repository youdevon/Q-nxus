"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { recalculateAfterTaxChange } from "@/src/modules/payroll/services/recalculate-after-tax-change";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type OpeningYtdFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

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
  options?: { required?: boolean },
): number | null {
  if (!value) {
    if (options?.required) {
      fieldErrors[field] = "Enter an amount.";
    }
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }
  return amount;
}

function toDecimal(value: number | null): Prisma.Decimal | null {
  if (value == null) {
    return null;
  }
  return new Prisma.Decimal(value.toFixed(2));
}

/**
 * Save current-employer opening YTD (system go-live migration balances).
 * This is NOT prior-employer income.
 */
export async function saveOpeningYtd(
  _previousState: OpeningYtdFormState,
  formData: FormData,
): Promise<OpeningYtdFormState> {
  const verified = formData.get("verified") === "on";
  const actor = await requireActor("payroll.setup", "payroll.manage");
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

  const asOfRaw = textValue(formData, "asOfDate");
  const asOfDate = asOfRaw ? parseDate(asOfRaw) : null;
  if (!asOfDate) {
    fieldErrors.asOfDate = "Enter the as-of date (YYYY-MM-DD).";
  }

  const taxableIncomeYtd = parseNonNegative(
    textValue(formData, "taxableIncomeYtd"),
    "taxableIncomeYtd",
    fieldErrors,
    { required: true },
  );
  const payeDeductedYtd = parseNonNegative(
    textValue(formData, "payeDeductedYtd"),
    "payeDeductedYtd",
    fieldErrors,
    { required: true },
  );
  const nisEmployeeYtd = parseNonNegative(
    textValue(formData, "nisEmployeeYtd"),
    "nisEmployeeYtd",
    fieldErrors,
  );
  const healthSurchargeYtd = parseNonNegative(
    textValue(formData, "healthSurchargeYtd"),
    "healthSurchargeYtd",
    fieldErrors,
  );
  const notes = nullableText(formData, "notes");

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the opening YTD information.",
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

  const taxProfile = await prisma.employeeTaxProfile.findUnique({
    where: {
      employeeId_taxYear: {
        employeeId: employee.id,
        taxYear,
      },
    },
    select: { id: true },
  });

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  try {
    await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeeOpeningYtdBalance.upsert({
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
          taxProfileId: taxProfile?.id ?? null,
          asOfDate: asOfDate!,
          taxableIncomeYtd: toDecimal(taxableIncomeYtd)!,
          payeDeductedYtd: toDecimal(payeDeductedYtd)!,
          nisEmployeeYtd: toDecimal(nisEmployeeYtd),
          healthSurchargeYtd: toDecimal(healthSurchargeYtd),
          verified,
          verifiedAt: verified ? now : null,
          verifiedByUserId: verified ? actor.actor.userId : null,
          notes,
          createdByUserId: actor.actor.userId,
          updatedByUserId: actor.actor.userId,
        },
        update: {
          taxProfileId: taxProfile?.id ?? null,
          asOfDate: asOfDate!,
          taxableIncomeYtd: toDecimal(taxableIncomeYtd)!,
          payeDeductedYtd: toDecimal(payeDeductedYtd)!,
          nisEmployeeYtd: toDecimal(nisEmployeeYtd),
          healthSurchargeYtd: toDecimal(healthSurchargeYtd),
          verified,
          verifiedAt: verified ? now : null,
          verifiedByUserId: verified ? actor.actor.userId : null,
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
        entityType: "EmployeeOpeningYtdBalance",
        entityId: row.id,
        description: `Updated ${taxYear} opening YTD (same employer / go-live) for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,
        newValues: {
          taxYear,
          asOfDate: asOfRaw,
          taxableIncomeYtd,
          payeDeductedYtd,
          nisEmployeeYtd,
          healthSurchargeYtd,
          verified,
        },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to save opening YTD:", error);
    return {
      status: "error",
      message: "Unable to save opening YTD. Try again.",
    };
  }

  const cascade = await recalculateAfterTaxChange({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    taxYear,
    actorUserId: actor.actor.userId,
    reason: "opening YTD (same employer / go-live) updated",
    metadata,
  });

  revalidatePath(`/payroll/employees/${employee.id}`);
  revalidatePath(`/payroll/employees/${employee.id}/tax-year`);
  revalidatePath(`/payroll/employees/${employee.id}/payslip`);
  revalidatePath(`/people/employees/${employee.id}`);
  revalidatePath("/payroll");

  const cascadeNote =
    cascade.draftRunsRecalculated > 0
      ? ` Recalculated ${cascade.draftRunsRecalculated} draft/approved pay run(s).`
      : "";

  return {
    status: "success",
    message: `Opening YTD for ${taxYear} saved.${cascadeNote}`,
  };
}
