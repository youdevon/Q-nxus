"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export type FileUpdateRequestActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function findPeopleManageRecipients(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      roles: {
        some: {
          status: "ACTIVE",
          role: {
            isActive: true,
            permissions: {
              some: {
                permission: {
                  code: "people.manage",
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
}

export async function submitQualificationUpdateRequest(
  _prev: FileUpdateRequestActionState,
  formData: FormData,
): Promise<FileUpdateRequestActionState> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    return { status: "error", message: "You cannot submit this request." };
  }

  const title = textValue(formData, "title");
  const note = textValue(formData, "note") || null;
  const fieldErrors: Record<string, string> = {};

  if (title.length < 3) {
    fieldErrors.title = "Enter a short title for the update.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the request details.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: capabilities.employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    return { status: "error", message: "Employee record not found." };
  }

  await getAuditRequestMetadata(formData);

  const created = await prisma.employeeFileUpdateRequest.create({
    data: {
      organizationId: employee.organizationId,
      employeeId: employee.id,
      requestType: "QUALIFICATION_UPDATE",
      title,
      note,
      status: "OPEN",
      requestedByUserId: capabilities.userId,
    },
    select: { id: true },
  });

  const hrRecipients = await findPeopleManageRecipients(employee.organizationId);
  const recipients = hrRecipients.filter(
    (user) => user.id !== capabilities.userId,
  );

  if (recipients.length > 0) {
    await createSystemNotification({
      title: "Qualification update requested",
      message: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) requested a qualification update: ${title}`,
      moduleKey: "hr",
      actionUrl: `/people/employees/${employee.id}/documents`,
      relatedType: "EmployeeFileUpdateRequest",
      relatedId: created.id,
      recipients: recipients.map((user) => ({
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        sendEmail: false,
      })),
    });
  }

  revalidatePath("/me/documents");
  revalidatePath("/me/qualifications");
  revalidatePath(`/people/employees/${employee.id}/documents`);

  return {
    status: "success",
    message: "Request submitted. HR has been notified.",
  };
}

const FILE_UPDATE_REQUEST_TYPES = [
  "QUALIFICATION_UPDATE",
  "COPY_OF_ID",
  "BIRTH_CERTIFICATE",
  "CREDENTIAL",
  "TRAINING",
  "OTHER",
] as const;

export async function submitEmployeeFileUpdateRequest(
  _prev: FileUpdateRequestActionState,
  formData: FormData,
): Promise<FileUpdateRequestActionState> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    return { status: "error", message: "You cannot submit this request." };
  }

  const title = textValue(formData, "title");
  const note = textValue(formData, "note") || null;
  const requestTypeRaw = textValue(formData, "requestType") || "OTHER";
  const fieldErrors: Record<string, string> = {};

  if (title.length < 3) {
    fieldErrors.title = "Enter a short title for the update.";
  }

  if (
    !FILE_UPDATE_REQUEST_TYPES.includes(
      requestTypeRaw as (typeof FILE_UPDATE_REQUEST_TYPES)[number],
    )
  ) {
    fieldErrors.requestType = "Select a valid request type.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the request details.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: capabilities.employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      fileFrozenAt: true,
    },
  });

  if (!employee) {
    return { status: "error", message: "Employee record not found." };
  }

  if (employee.fileFrozenAt) {
    return {
      status: "error",
      message: "Your employee file is frozen and cannot accept new requests.",
    };
  }

  const file = formData.get("attachment");
  let fileName: string | null = null;
  let storageKey: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let storedFileId: string | null = null;

  if (file instanceof File && file.size > 0) {
    const {
      employeeStorageFolderLabel,
      storeUploadedFile,
      resolveStoredFileAbsolutePath,
    } = await import("@/src/lib/stored-file");
    const { createStoredFileRecord } = await import(
      "@/src/modules/hr/lib/create-stored-file-record"
    );

    storageKey = `employee-file/${employeeStorageFolderLabel(employee)}/file-requests/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}`;
    const stored = await storeUploadedFile({
      storageKey,
      file,
      resolveAbsolutePath: (key) =>
        resolveStoredFileAbsolutePath(key, "employee-file"),
    });
    fileName = stored.fileName;
    mimeType = stored.mimeType;
    fileSize = stored.fileSize;
    storedFileId = await createStoredFileRecord({
      organizationId: employee.organizationId,
      meta: stored,
      uploadedByUserId: capabilities.userId,
    });
  }

  await getAuditRequestMetadata(formData);

  const created = await prisma.employeeFileUpdateRequest.create({
    data: {
      organizationId: employee.organizationId,
      employeeId: employee.id,
      requestType: requestTypeRaw as (typeof FILE_UPDATE_REQUEST_TYPES)[number],
      title,
      note,
      status: "OPEN",
      requestedByUserId: capabilities.userId,
      fileName,
      storageKey,
      mimeType,
      fileSize,
      storedFileId,
    },
    select: { id: true },
  });

  const hrRecipients = await findPeopleManageRecipients(employee.organizationId);
  const recipients = hrRecipients.filter(
    (user) => user.id !== capabilities.userId,
  );

  if (recipients.length > 0) {
    await createSystemNotification({
      title: "Employee file update requested",
      message: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) requested a file update: ${title}`,
      moduleKey: "hr",
      actionUrl: `/people/employees/${employee.id}/documents`,
      relatedType: "EmployeeFileUpdateRequest",
      relatedId: created.id,
      recipients: recipients.map((user) => ({
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        sendEmail: false,
      })),
    });
  }

  revalidatePath("/me/documents");
  revalidatePath("/me/qualifications");
  revalidatePath(`/people/employees/${employee.id}/documents`);

  return {
    status: "success",
    message: "Request submitted. HR has been notified.",
  };
}

export async function resolveQualificationUpdateRequest(
  _prev: FileUpdateRequestActionState,
  formData: FormData,
): Promise<FileUpdateRequestActionState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const requestId = textValue(formData, "requestId");
  const employeeId = textValue(formData, "employeeId");

  if (!requestId || !employeeId) {
    return { status: "error", message: "Request is required." };
  }

  const existing = await prisma.employeeFileUpdateRequest.findFirst({
    where: { id: requestId, employeeId },
    select: { id: true, status: true, title: true },
  });

  if (!existing) {
    return { status: "error", message: "Request not found." };
  }

  if (existing.status === "RESOLVED") {
    return { status: "success", message: "Request was already resolved." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeFileUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByUserId: actor.actor.userId,
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "EmployeeFileUpdateRequest",
        entityId: requestId,
        description: `Resolved qualification update request “${existing.title}”.`,
        newValues: { status: "RESOLVED" },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
  revalidatePath("/me/qualifications");

  return { status: "success", message: "Request marked resolved." };
}
