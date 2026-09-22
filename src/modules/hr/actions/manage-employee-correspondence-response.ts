"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import {
  canEmployeeSubmitCorrespondenceResponse,
  canHrReviewCorrespondenceResponse,
  canTransitionCorrespondenceResponseStatus,
  RESPONSE_BODY_MAX_LENGTH,
} from "@/src/modules/hr/lib/correspondence-response";
import { storeCorrespondenceAttachmentFile } from "@/src/modules/hr/lib/store-correspondence-attachment";
import { notifyCorrespondenceResponseReviewed } from "@/src/modules/hr/services/notify-correspondence-response-reviewed";
import { notifyCorrespondenceResponseSubmitted } from "@/src/modules/hr/services/notify-correspondence-response-submitted";

export type CorrespondenceResponseActionState = {
  status: "idle" | "success" | "error";
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

function revalidateCorrespondenceResponsePaths(
  employeeId: string,
  correspondenceId: string,
) {
  revalidatePath(`/people/employees/${employeeId}/documents/${correspondenceId}`);
  revalidatePath(`/me/documents/${correspondenceId}`);
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
}

async function storeOptionalResponseAttachment({
  employee,
  correspondenceId,
  formData,
}: {
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  correspondenceId: string;
  formData: FormData;
}) {
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!attachmentFile) {
    return null;
  }

  return storeCorrespondenceAttachmentFile({
    employee,
    correspondenceId,
    file: attachmentFile,
  });
}

export async function submitEmployeeCorrespondenceResponse(
  _prev: CorrespondenceResponseActionState,
  formData: FormData,
): Promise<CorrespondenceResponseActionState> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    return { status: "error", message: "You cannot submit this response." };
  }

  const correspondenceId = textValue(formData, "correspondenceId");
  const body = textValue(formData, "body");
  const fieldErrors: Record<string, string> = {};

  if (!correspondenceId) {
    return { status: "error", message: "Letter not found." };
  }

  if (body.length < 10) {
    fieldErrors.body = "Enter a short statement (at least 10 characters).";
  }

  if (body.length > RESPONSE_BODY_MAX_LENGTH) {
    fieldErrors.body = `Statement must be ${RESPONSE_BODY_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review your response.",
      fieldErrors,
    };
  }

  const correspondence = await prisma.employeeCorrespondence.findFirst({
    where: {
      id: correspondenceId,
      employeeId: capabilities.employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      employeeId: true,
      status: true,
      employeeVisible: true,
      allowsEmployeeResponse: true,
      title: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      responses: {
        select: {
          id: true,
          status: true,
        },
        take: 1,
      },
    },
  });

  if (!correspondence) {
    return { status: "error", message: "Letter not found." };
  }

  const existing = correspondence.responses[0] ?? null;

  if (
    !canEmployeeSubmitCorrespondenceResponse(
      {
        status: correspondence.status,
        employeeVisible: correspondence.employeeVisible,
        allowsEmployeeResponse: correspondence.allowsEmployeeResponse,
      },
      existing,
    )
  ) {
    return {
      status: "error",
      message: "You cannot submit a response for this letter.",
    };
  }

  let storedAttachment: Awaited<
    ReturnType<typeof storeOptionalResponseAttachment>
  > = null;

  try {
    storedAttachment = await storeOptionalResponseAttachment({
      employee: correspondence.employee,
      correspondenceId: correspondence.id,
      formData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload attachment.";
    return { status: "error", message };
  }

  const metadata = await getAuditRequestMetadata(formData);
  let responseId = existing?.id ?? "";

  try {
    if (existing) {
      await prisma.$transaction(async (transaction) => {
        await transaction.employeeCorrespondenceResponse.update({
          where: { id: existing.id },
          data: {
            body,
            submittedAt: new Date(),
            ...(storedAttachment
              ? {
                  fileName: storedAttachment.fileName,
                  storageKey: storedAttachment.storageKey,
                  mimeType: storedAttachment.mimeType,
                  fileSize: storedAttachment.fileSize,
                }
              : {}),
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: capabilities.userId,
            moduleKey: "hr",
            action: "UPDATE",
            entityType: "EmployeeCorrespondenceResponse",
            entityId: existing.id,
            description: `Updated response to “${correspondence.title}”.`,
            newValues: { status: "OPEN" },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });
      });
      responseId = existing.id;
    } else {
      const created = await prisma.$transaction(async (transaction) => {
        const response = await transaction.employeeCorrespondenceResponse.create({
          data: {
            organizationId: correspondence.organizationId,
            correspondenceId: correspondence.id,
            employeeId: correspondence.employeeId,
            body,
            status: "OPEN",
            ...(storedAttachment
              ? {
                  fileName: storedAttachment.fileName,
                  storageKey: storedAttachment.storageKey,
                  mimeType: storedAttachment.mimeType,
                  fileSize: storedAttachment.fileSize,
                }
              : {}),
          },
          select: { id: true },
        });

        await transaction.auditEvent.create({
          data: {
            userId: capabilities.userId,
            moduleKey: "hr",
            action: "CREATE",
            entityType: "EmployeeCorrespondenceResponse",
            entityId: response.id,
            description: `Submitted response to “${correspondence.title}”.`,
            newValues: { status: "OPEN" },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        return response;
      });
      responseId = created.id;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save your response.";
    return { status: "error", message };
  }

  try {
    await notifyCorrespondenceResponseSubmitted(responseId);
  } catch (error) {
    console.error("Correspondence response notification failed:", error);
  }

  revalidateCorrespondenceResponsePaths(
    correspondence.employeeId,
    correspondence.id,
  );

  return {
    status: "success",
    message: existing
      ? "Response updated. HR has been notified."
      : "Response submitted. HR has been notified.",
  };
}

export async function reviewEmployeeCorrespondenceResponse(
  _prev: CorrespondenceResponseActionState,
  formData: FormData,
): Promise<CorrespondenceResponseActionState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const responseId = textValue(formData, "responseId");
  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");
  const reviewNote = nullableText(formData, "reviewNote");

  if (!responseId || !employeeId || !correspondenceId) {
    return { status: "error", message: "Response not found." };
  }

  const existing = await prisma.employeeCorrespondenceResponse.findFirst({
    where: {
      id: responseId,
      correspondenceId,
      employeeId,
    },
    select: {
      id: true,
      status: true,
      correspondence: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!existing) {
    return { status: "error", message: "Response not found." };
  }

  if (!canHrReviewCorrespondenceResponse(existing)) {
    return {
      status: "success",
      message: "Response was already reviewed.",
    };
  }

  if (!canTransitionCorrespondenceResponseStatus(existing.status, "REVIEWED")) {
    return { status: "error", message: "This response cannot be reviewed." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeCorrespondenceResponse.update({
      where: { id: responseId },
      data: {
        status: "REVIEWED",
        reviewedAt: new Date(),
        reviewedByUserId: actor.actor.userId,
        reviewNote,
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "EmployeeCorrespondenceResponse",
        entityId: responseId,
        description: `Reviewed employee response to “${existing.correspondence.title}”.`,
        oldValues: { status: existing.status },
        newValues: { status: "REVIEWED" },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  try {
    await notifyCorrespondenceResponseReviewed(responseId);
  } catch (error) {
    console.error("Correspondence response reviewed notification failed:", error);
  }

  revalidateCorrespondenceResponsePaths(employeeId, correspondenceId);

  return { status: "success", message: "Response marked as reviewed." };
}
