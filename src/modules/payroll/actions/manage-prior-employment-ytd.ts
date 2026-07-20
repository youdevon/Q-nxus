"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
  storeUploadedFile,
} from "@/src/lib/stored-file";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { createStoredFileRecord } from "@/src/modules/hr/lib/create-stored-file-record";
import { syncTaxProfilePreviousEmploymentFlags } from "@/src/modules/payroll/services/sync-tax-profile-previous-employment";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type PriorEmploymentFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

const DOCUMENT_TYPES = [
  "TD4",
  "PRIOR_EMPLOYER_LETTER",
  "PAYSLIP",
  "OTHER",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

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

async function loadEmployee(employeeId: string) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });
}

export async function savePriorEmploymentYtd(
  _previousState: PriorEmploymentFormState,
  formData: FormData,
): Promise<PriorEmploymentFormState> {
  const actor = await requireActor("payroll.setup", "payroll.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const recordId = nullableText(formData, "recordId");
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

  const employerName = textValue(formData, "employerName");
  if (!employerName) {
    fieldErrors.employerName = "Enter the prior employer name.";
  }

  const asOfRaw = textValue(formData, "asOfDate");
  const asOfDate = parseDate(asOfRaw);
  if (!asOfDate) {
    fieldErrors.asOfDate = "Enter the YTD as-of date (YYYY-MM-DD).";
  }

  const employmentStartRaw = textValue(formData, "employmentStartDate");
  let employmentStartDate: Date | null = null;
  if (employmentStartRaw) {
    employmentStartDate = parseDate(employmentStartRaw);
    if (!employmentStartDate) {
      fieldErrors.employmentStartDate = "Use YYYY-MM-DD.";
    }
  }

  const employmentEndRaw = textValue(formData, "employmentEndDate");
  let employmentEndDate: Date | null = null;
  if (employmentEndRaw) {
    employmentEndDate = parseDate(employmentEndRaw);
    if (!employmentEndDate) {
      fieldErrors.employmentEndDate = "Use YYYY-MM-DD.";
    }
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
  const nisEmployerYtd = parseNonNegative(
    textValue(formData, "nisEmployerYtd"),
    "nisEmployerYtd",
    fieldErrors,
  );
  const healthSurchargeYtd = parseNonNegative(
    textValue(formData, "healthSurchargeYtd"),
    "healthSurchargeYtd",
    fieldErrors,
  );
  const otherApprovedDeductionsYtd = parseNonNegative(
    textValue(formData, "otherApprovedDeductionsYtd"),
    "otherApprovedDeductionsYtd",
    fieldErrors,
  );

  const verified = formData.get("verified") === "on";
  const notes = nullableText(formData, "notes");
  const employerBirNumber = nullableText(formData, "employerBirNumber");

  const documentTypeRaw = textValue(formData, "documentType");
  const documentType = DOCUMENT_TYPES.includes(documentTypeRaw as DocumentType)
    ? (documentTypeRaw as DocumentType)
    : "OTHER";
  const documentLabel = nullableText(formData, "documentLabel");
  const attachment = formData.get("attachment");
  const hasAttachment =
    attachment instanceof File && attachment.size > 0 && attachment.name;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the prior employment information.",
      fieldErrors,
    };
  }

  const employee = await loadEmployee(employeeId);
  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    let storedFileId: string | null = null;
    let storedMeta: { storageKey: string; fileName: string } | null = null;

    if (hasAttachment) {
      const file = attachment as File;
      const storageKey = `payroll/${employee.organizationId}/prior-employment/${employee.id}/${Date.now()}-${safeStoredFileName(file.name)}`;
      const stored = await storeUploadedFile({
        storageKey,
        file,
        resolveAbsolutePath: (key) =>
          resolveStoredFileAbsolutePath(key, "payroll"),
      });
      storedFileId = await createStoredFileRecord({
        organizationId: employee.organizationId,
        meta: stored,
        uploadedByUserId: actor.actor.userId,
      });
      storedMeta = { storageKey: stored.storageKey, fileName: stored.fileName };
    }

    await prisma.$transaction(async (transaction) => {
      const taxProfile = await transaction.employeeTaxProfile.findUnique({
        where: {
          employeeId_taxYear: {
            employeeId: employee.id,
            taxYear,
          },
        },
        select: { id: true },
      });

      const values = {
        employerName: employerName!,
        employerBirNumber,
        employmentStartDate,
        employmentEndDate,
        asOfDate: asOfDate!,
        currencyCode: "TTD",
        taxableIncomeYtd: toDecimal(taxableIncomeYtd)!,
        payeDeductedYtd: toDecimal(payeDeductedYtd)!,
        nisEmployeeYtd: toDecimal(nisEmployeeYtd),
        nisEmployerYtd: toDecimal(nisEmployerYtd),
        healthSurchargeYtd: toDecimal(healthSurchargeYtd),
        otherApprovedDeductionsYtd: toDecimal(otherApprovedDeductionsYtd),
        status: "ACTIVE" as const,
        verified,
        verifiedAt: verified ? new Date() : null,
        verifiedByUserId: verified ? actor.actor.userId : null,
        notes,
        taxProfileId: taxProfile?.id ?? null,
        updatedByUserId: actor.actor.userId,
      };

      let savedId: string;

      if (recordId) {
        const existing = await transaction.employeePriorEmploymentYtd.findFirst({
          where: {
            id: recordId,
            employeeId: employee.id,
            organizationId: employee.organizationId,
          },
          select: { id: true },
        });
        if (!existing) {
          throw new Error("Prior employment record not found.");
        }

        const updated = await transaction.employeePriorEmploymentYtd.update({
          where: { id: existing.id },
          data: values,
          select: { id: true },
        });
        savedId = updated.id;
      } else {
        const created = await transaction.employeePriorEmploymentYtd.create({
          data: {
            organizationId: employee.organizationId,
            employeeId: employee.id,
            taxYear,
            createdByUserId: actor.actor.userId,
            ...values,
          },
          select: { id: true },
        });
        savedId = created.id;
      }

      if (storedFileId) {
        await transaction.employeePriorEmploymentDocument.create({
          data: {
            organizationId: employee.organizationId,
            priorEmploymentYtdId: savedId,
            documentType,
            label: documentLabel ?? storedMeta?.fileName ?? null,
            storedFileId,
            uploadedByUserId: actor.actor.userId,
          },
        });
      }

      await syncTaxProfilePreviousEmploymentFlags(transaction, {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        taxYear,
        userId: actor.actor.userId,
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: recordId ? "UPDATE" : "CREATE",
        entityType: "EmployeePriorEmploymentYtd",
        entityId: savedId,
        description: `${recordId ? "Updated" : "Added"} prior-employer YTD for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) · ${taxYear}.`,
        newValues: {
          taxYear,
          employerName,
          taxableIncomeYtd,
          payeDeductedYtd,
          verified,
          documentAttached: storedFileId != null,
        },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to save prior employment YTD:", error);
    return {
      status: "error",
      message:
        error instanceof Error && error.message.includes("not found")
          ? error.message
          : "Unable to save prior employment YTD. Try again.",
    };
  }

  revalidatePath(`/payroll/employees/${employee.id}`);
  revalidatePath(`/people/employees/${employee.id}`);

  return {
    status: "success",
    message: recordId
      ? "Prior employment YTD updated."
      : "Prior employment YTD saved.",
  };
}

export async function archivePriorEmploymentYtd(
  _previousState: PriorEmploymentFormState,
  formData: FormData,
): Promise<PriorEmploymentFormState> {
  const actor = await requireActor("payroll.setup", "payroll.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const recordId = textValue(formData, "recordId");
  if (!employeeId || !recordId) {
    return { status: "error", message: "Missing record reference." };
  }

  const employee = await loadEmployee(employeeId);
  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.employeePriorEmploymentYtd.findFirst({
        where: {
          id: recordId,
          employeeId: employee.id,
          organizationId: employee.organizationId,
        },
        select: { id: true, taxYear: true, employerName: true },
      });
      if (!existing) {
        throw new Error("Prior employment record not found.");
      }

      await transaction.employeePriorEmploymentYtd.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          updatedByUserId: actor.actor.userId,
        },
      });

      await syncTaxProfilePreviousEmploymentFlags(transaction, {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        taxYear: existing.taxYear,
        userId: actor.actor.userId,
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeePriorEmploymentYtd",
        entityId: existing.id,
        description: `Archived prior-employer YTD (${existing.employerName}) for ${employee.firstName} ${employee.lastName}.`,
        newValues: { status: "ARCHIVED" },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to archive prior employment YTD:", error);
    return {
      status: "error",
      message: "Unable to archive the record. Try again.",
    };
  }

  revalidatePath(`/payroll/employees/${employee.id}`);
  return { status: "success", message: "Prior employment record archived." };
}
