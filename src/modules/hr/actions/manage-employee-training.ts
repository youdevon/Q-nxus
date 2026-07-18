"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { storeEmployeeFileAttachment, deleteEmployeeFileAttachment } from "@/src/modules/hr/lib/store-employee-file-attachment";

export type TrainingFormState = {
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

function revalidateTrainingPaths(employeeId: string) {
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
  revalidatePath("/me");
}

export async function createEmployeeTrainingRecord(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const courseName = textValue(formData, "courseName");
  const provider = nullableText(formData, "provider");
  const completedAt = parseDate(textValue(formData, "completedAt"));
  const expiryDate = parseDate(textValue(formData, "expiryDate"));
  const employeeVisible = checkboxValue(formData, "employeeVisible");

  const fieldErrors: Record<string, string> = {};

  if (courseName.length < 2) {
    fieldErrors.courseName = "Enter a course name.";
  }

  if (!completedAt) {
    fieldErrors.completedAt = "Enter the completion date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the training record.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true, firstName: true, lastName: true },
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

  try {
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeTrainingRecord.create({
        data: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          courseName,
          provider,
          completedAt: completedAt!,
          expiryDate,
          employeeVisible,
        },
        select: { id: true },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          recordType: "training",
          recordId: created.id,
          file: attachmentFile,
        });

        await transaction.employeeTrainingRecord.update({
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
          entityType: "EmployeeTrainingRecord",
          entityId: created.id,
          description: `Added training “${courseName}” for ${employee.firstName} ${employee.lastName}`,
          newValues: {
            courseName,
            completedAt: completedAt!.toISOString().slice(0, 10),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the training record.";
    return { status: "error", message };
  }

  revalidateTrainingPaths(employee.id);
  redirect(`/people/employees/${employee.id}/documents`);
}

export async function updateEmployeeTrainingRecord(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const trainingId = textValue(formData, "trainingId");
  const courseName = textValue(formData, "courseName");
  const provider = nullableText(formData, "provider");
  const completedAt = parseDate(textValue(formData, "completedAt"));
  const expiryDate = parseDate(textValue(formData, "expiryDate"));
  const employeeVisible = checkboxValue(formData, "employeeVisible");

  const fieldErrors: Record<string, string> = {};

  if (courseName.length < 2) {
    fieldErrors.courseName = "Enter a course name.";
  }

  if (!completedAt) {
    fieldErrors.completedAt = "Enter the completion date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the training record.",
      fieldErrors,
    };
  }

  const existing = await prisma.employeeTrainingRecord.findFirst({
    where: { id: trainingId, employeeId },
    select: { id: true, courseName: true, storageKey: true },
  });

  if (!existing) {
    return { status: "error", message: "Training record not found." };
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
      await transaction.employeeTrainingRecord.update({
        where: { id: existing.id },
        data: {
          courseName,
          provider,
          completedAt: completedAt!,
          expiryDate,
          employeeVisible,
        },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          recordType: "training",
          recordId: existing.id,
          file: attachmentFile,
        });

        await transaction.employeeTrainingRecord.update({
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
          entityType: "EmployeeTrainingRecord",
          entityId: existing.id,
          description: `Updated training “${courseName}”`,
          oldValues: { courseName: existing.courseName },
          newValues: { courseName },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update the training record.";
    return { status: "error", message };
  }

  if (attachmentFile && previousStorageKey) {
    await deleteEmployeeFileAttachment(previousStorageKey);
  }

  revalidateTrainingPaths(employeeId);
  redirect(`/people/employees/${employeeId}/documents`);
}

export async function deleteEmployeeTrainingRecord(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const trainingId = textValue(formData, "trainingId");

  const existing = await prisma.employeeTrainingRecord.findFirst({
    where: { id: trainingId, employeeId },
    select: { id: true, courseName: true, storageKey: true },
  });

  if (!existing) {
    throw new Error("Training record not found.");
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeTrainingRecord.delete({
      where: { id: existing.id },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "DELETE",
        entityType: "EmployeeTrainingRecord",
        entityId: existing.id,
        description: `Removed training “${existing.courseName}”`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  if (existing.storageKey) {
    await deleteEmployeeFileAttachment(existing.storageKey);
  }

  revalidateTrainingPaths(employeeId);
}
