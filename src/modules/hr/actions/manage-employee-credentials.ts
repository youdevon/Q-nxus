"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  deleteEmployeeFileAttachment,
  storeEmployeeFileAttachment,
} from "@/src/modules/hr/lib/store-employee-file-attachment";

export type CredentialFormState = {
  status: "idle" | "error";
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
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function checkboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function revalidateCredentialPaths(employeeId: string) {
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
  revalidatePath("/me");
}

export async function createEmployeeCredential(
  _previousState: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const name = textValue(formData, "name");
  const issuer = nullableText(formData, "issuer");
  const issueDate = parseDate(textValue(formData, "issueDate"));
  const expiryDate = parseDate(textValue(formData, "expiryDate"));
  const employeeVisible = checkboxValue(formData, "employeeVisible");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = "Enter a credential name.";
  }

  if (
    issueDate &&
    expiryDate &&
    expiryDate < issueDate
  ) {
    fieldErrors.expiryDate = "Expiry cannot be before the issue date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the credential details.",
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

  const metadata = await getAuditRequestMetadata(formData);
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  let createdId = "";

  try {
    createdId = await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeCredential.create({
        data: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          name,
          issuer,
          issueDate,
          expiryDate,
          employeeVisible,
        },
        select: { id: true },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          employee,
          recordType: "credentials",
          recordId: created.id,
          file: attachmentFile,
        });

        await transaction.employeeCredential.update({
          where: { id: created.id },
          data: {
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "EmployeeCredential",
          entityId: created.id,
          description: `Added credential “${name}” for ${employee.firstName} ${employee.lastName}`,
          newValues: { name, expiryDate: expiryDate?.toISOString().slice(0, 10) },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created.id;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the credential.";
    return { status: "error", message };
  }

  revalidateCredentialPaths(employee.id);
  redirect(`/people/employees/${employee.id}/documents`);
}

export async function updateEmployeeCredential(
  _previousState: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const credentialId = textValue(formData, "credentialId");
  const name = textValue(formData, "name");
  const issuer = nullableText(formData, "issuer");
  const issueDate = parseDate(textValue(formData, "issueDate"));
  const expiryDate = parseDate(textValue(formData, "expiryDate"));
  const employeeVisible = checkboxValue(formData, "employeeVisible");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = "Enter a credential name.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the credential details.",
      fieldErrors,
    };
  }

  const existing = await prisma.employeeCredential.findFirst({
    where: { id: credentialId, employeeId },
    select: {
      id: true,
      name: true,
      storageKey: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existing) {
    return { status: "error", message: "Credential not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;
  const previousStorageKey = existing.storageKey;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employeeCredential.update({
        where: { id: existing.id },
        data: {
          name,
          issuer,
          issueDate,
          expiryDate,
          employeeVisible,
        },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          employee: existing.employee,
          recordType: "credentials",
          recordId: existing.id,
          file: attachmentFile,
        });

        await transaction.employeeCredential.update({
          where: { id: existing.id },
          data: {
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmployeeCredential",
          entityId: existing.id,
          description: `Updated credential “${name}”`,
          oldValues: { name: existing.name },
          newValues: { name },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update the credential.";
    return { status: "error", message };
  }

  if (attachmentFile && previousStorageKey) {
    await deleteEmployeeFileAttachment(previousStorageKey);
  }

  revalidateCredentialPaths(employeeId);
  redirect(`/people/employees/${employeeId}/documents`);
}

export async function deleteEmployeeCredential(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const credentialId = textValue(formData, "credentialId");

  const existing = await prisma.employeeCredential.findFirst({
    where: { id: credentialId, employeeId },
    select: { id: true, name: true, storageKey: true },
  });

  if (!existing) {
    throw new Error("Credential not found.");
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeCredential.delete({
      where: { id: existing.id },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "DELETE",
        entityType: "EmployeeCredential",
        entityId: existing.id,
        description: `Removed credential “${existing.name}”`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  if (existing.storageKey) {
    await deleteEmployeeFileAttachment(existing.storageKey);
  }

  revalidateCredentialPaths(employeeId);
}
