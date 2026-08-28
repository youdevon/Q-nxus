"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CorrespondenceCategory,
  CorrespondenceStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  applyCorrespondenceMergeFields,
  buildCorrespondenceMergeContext,
} from "@/src/modules/hr/lib/correspondence-merge-fields";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import {
  canCreateSupersedingDraft,
  statusAfterSupersedingIssue,
} from "@/src/modules/hr/lib/correspondence-supersede";
import {
  canEmployeeAcknowledgeCorrespondence,
  canHrArchiveCorrespondence,
  canHrEditCorrespondence,
  canHrIssueCorrespondence,
  defaultRetentionUntil,
  isCorrespondenceCategory,
  isRestrictedCategory,
} from "@/src/modules/hr/lib/correspondence-visibility";
import { storeCorrespondenceAttachmentFile } from "@/src/modules/hr/lib/store-correspondence-attachment";
import { notifyCorrespondenceAcknowledgementReminders } from "@/src/modules/hr/services/notify-correspondence-acknowledgement";
import { notifyCorrespondenceIssued } from "@/src/modules/hr/services/notify-correspondence-issue";

export type CorrespondenceFormState = {
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

function revalidateCorrespondencePaths(
  employeeId: string,
  correspondenceId?: string,
) {
  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/people/documents");
  revalidatePath("/me");
  revalidatePath("/me/documents");

  if (correspondenceId) {
    revalidatePath(
      `/people/employees/${employeeId}/documents/${correspondenceId}`,
    );
    revalidatePath(`/me/documents/${correspondenceId}`);
  }
}

async function storeOptionalAttachment({
  employee,
  correspondenceId,
  formData,
  uploadedByUserId,
}: {
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  correspondenceId: string;
  formData: FormData;
  uploadedByUserId: string;
}) {
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!attachmentFile) {
    return;
  }

  const stored = await storeCorrespondenceAttachmentFile({
    employee,
    correspondenceId,
    file: attachmentFile,
  });

  await prisma.employeeCorrespondenceAttachment.create({
    data: {
      correspondenceId,
      fileName: stored.fileName,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      uploadedByUserId,
    },
  });
}

function applyCategoryVisibilityDefaults(
  category: CorrespondenceCategory,
  employeeVisible: boolean,
  managerVisible: boolean,
): { employeeVisible: boolean; managerVisible: boolean } {
  if (isRestrictedCategory(category)) {
    return { employeeVisible: false, managerVisible: false };
  }

  return { employeeVisible, managerVisible };
}

function parseCorrespondenceFields(formData: FormData): {
  fieldErrors: Record<string, string>;
  category: CorrespondenceCategory | null;
  subType: string | null;
  title: string;
  body: string | null;
  effectiveDate: Date | null;
  retentionUntil: Date | null;
  employeeVisible: boolean;
  managerVisible: boolean;
  requiresAcknowledgement: boolean;
  allowsEmployeeResponse: boolean;
  templateId: string | null;
} {
  const categoryValue = textValue(formData, "category");
  const title = textValue(formData, "title");
  const body = nullableText(formData, "body");
  const subType = nullableText(formData, "subType");
  const effectiveDate = parseDate(textValue(formData, "effectiveDate"));
  const retentionUntil = parseDate(textValue(formData, "retentionUntil"));
  const employeeVisible = checkboxValue(formData, "employeeVisible");
  const managerVisible = checkboxValue(formData, "managerVisible");
  const requiresAcknowledgement = checkboxValue(
    formData,
    "requiresAcknowledgement",
  );
  const allowsEmployeeResponse = checkboxValue(
    formData,
    "allowsEmployeeResponse",
  );
  const templateId = nullableText(formData, "templateId");

  const fieldErrors: Record<string, string> = {};
  let category: CorrespondenceCategory | null = null;

  if (!isCorrespondenceCategory(categoryValue)) {
    fieldErrors.category = "Select a valid category.";
  } else {
    category = categoryValue;
  }

  if (title.length < 2) {
    fieldErrors.title = "Enter a title.";
  }

  if (!effectiveDate) {
    fieldErrors.effectiveDate = "Enter the effective date.";
  }

  if (
    effectiveDate &&
    retentionUntil &&
    retentionUntil < effectiveDate
  ) {
    fieldErrors.retentionUntil =
      "Retention date cannot be before the effective date.";
  }

  return {
    fieldErrors,
    category,
    subType,
    title,
    body,
    effectiveDate,
    retentionUntil,
    employeeVisible,
    managerVisible,
    requiresAcknowledgement,
    allowsEmployeeResponse,
    templateId,
  };
}

async function finalizeIssuedCorrespondence(
  correspondenceId: string,
  employeeId: string,
) {
  try {
    await notifyCorrespondenceIssued(correspondenceId);
  } catch (error) {
    console.error("Correspondence issue notification failed:", error);
  }

  revalidateCorrespondencePaths(employeeId, correspondenceId);
}

export async function createEmployeeCorrespondence(
  _previousState: CorrespondenceFormState,
  formData: FormData,
): Promise<CorrespondenceFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const parsed = parseCorrespondenceFields(formData);
  const issueNow = checkboxValue(formData, "issueNow");

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.category) {
    return {
      status: "error",
      message: "Review the correspondence details.",
      fieldErrors: parsed.fieldErrors,
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
      position: { select: { title: true } },
    },
  });

  if (!employee) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    };
  }

  const visibility = applyCategoryVisibilityDefaults(
    parsed.category,
    parsed.employeeVisible,
    parsed.managerVisible,
  );
  const requiresAcknowledgement = parsed.requiresAcknowledgement;
  const allowsEmployeeResponse = parsed.allowsEmployeeResponse;

  const metadata = await getAuditRequestMetadata(formData);
  const issueDate = issueNow ? parsed.effectiveDate! : null;
  const status = issueNow
    ? CorrespondenceStatus.ISSUED
    : CorrespondenceStatus.DRAFT;
  const retentionUntil =
    parsed.retentionUntil ??
    (issueNow
      ? defaultRetentionUntil(parsed.category, parsed.effectiveDate!)
      : null);

  let createdId = "";

  try {
    createdId = await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeCorrespondence.create({
        data: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          category: parsed.category!,
          subType: parsed.subType,
          title: parsed.title,
          body: parsed.body,
          effectiveDate: parsed.effectiveDate!,
          issueDate,
          issuedByUserId: issueNow ? actor.actor.userId : null,
          status,
          employeeVisible: visibility.employeeVisible,
          managerVisible: visibility.managerVisible,
          requiresAcknowledgement,
          allowsEmployeeResponse,
          retentionUntil,
          templateId: parsed.templateId,
        },
        select: { id: true },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: issueNow ? "ISSUE" : "CREATE",
          entityType: "EmployeeCorrespondence",
          entityId: created.id,
          description: issueNow
            ? `Issued correspondence “${parsed.title}” for ${employee.firstName} ${employee.lastName}`
            : `Created draft correspondence “${parsed.title}” for ${employee.firstName} ${employee.lastName}`,
          newValues: {
            category: parsed.category,
            subType: parsed.subType,
            title: parsed.title,
            status,
            employeeVisible: visibility.employeeVisible,
            managerVisible: visibility.managerVisible,
            requiresAcknowledgement,
            effectiveDate: parsed.effectiveDate!.toISOString().slice(0, 10),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created.id;
    });

    await storeOptionalAttachment({
      employee,
      correspondenceId: createdId,
      formData,
      uploadedByUserId: actor.actor.userId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save the correspondence.";
    return { status: "error", message };
  }

  if (issueNow) {
    await finalizeIssuedCorrespondence(createdId, employee.id);
  } else {
    revalidateCorrespondencePaths(employee.id, createdId);
  }

  redirect(`/people/employees/${employee.id}/documents/${createdId}`);
}

export async function updateEmployeeCorrespondence(
  _previousState: CorrespondenceFormState,
  formData: FormData,
): Promise<CorrespondenceFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");
  const parsed = parseCorrespondenceFields(formData);

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.category) {
    return {
      status: "error",
      message: "Review the correspondence details.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      status: true,
      title: true,
      category: true,
      employeeVisible: true,
      managerVisible: true,
      requiresAcknowledgement: true,
      effectiveDate: true,
      retentionUntil: true,
      body: true,
      subType: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
    },
  });

  if (!existing) {
    return {
      status: "error",
      message: "The correspondence record no longer exists.",
    };
  }

  if (!canHrEditCorrespondence(existing.status)) {
    return {
      status: "error",
      message: "Issued correspondence cannot be edited. Supersede it instead.",
    };
  }

  const visibility = applyCategoryVisibilityDefaults(
    parsed.category,
    parsed.employeeVisible,
    parsed.managerVisible,
  );
  const requiresAcknowledgement = parsed.requiresAcknowledgement;
  const allowsEmployeeResponse = parsed.allowsEmployeeResponse;

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employeeCorrespondence.update({
        where: { id: existing.id },
        data: {
          category: parsed.category!,
          subType: parsed.subType,
          title: parsed.title,
          body: parsed.body,
          effectiveDate: parsed.effectiveDate!,
          employeeVisible: visibility.employeeVisible,
          managerVisible: visibility.managerVisible,
          requiresAcknowledgement,
          allowsEmployeeResponse,
          retentionUntil: parsed.retentionUntil,
          templateId: parsed.templateId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmployeeCorrespondence",
          entityId: existing.id,
          description: `Updated draft correspondence “${parsed.title}” for ${existing.employee.firstName} ${existing.employee.lastName}`,
          oldValues: {
            category: existing.category,
            subType: existing.subType,
            title: existing.title,
            employeeVisible: existing.employeeVisible,
            managerVisible: existing.managerVisible,
            requiresAcknowledgement: existing.requiresAcknowledgement,
            effectiveDate: existing.effectiveDate.toISOString().slice(0, 10),
          },
          newValues: {
            category: parsed.category,
            subType: parsed.subType,
            title: parsed.title,
            employeeVisible: visibility.employeeVisible,
            managerVisible: visibility.managerVisible,
            requiresAcknowledgement,
            effectiveDate: parsed.effectiveDate!.toISOString().slice(0, 10),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    await storeOptionalAttachment({
      employee: existing.employee,
      correspondenceId: existing.id,
      formData,
      uploadedByUserId: actor.actor.userId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update the correspondence.";
    return { status: "error", message };
  }

  revalidateCorrespondencePaths(employeeId, correspondenceId);
  redirect(`/people/employees/${employeeId}/documents/${correspondenceId}`);
}

export async function issueEmployeeCorrespondence(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      status: true,
      title: true,
      category: true,
      effectiveDate: true,
      retentionUntil: true,
      supersedesId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("The correspondence record no longer exists.");
  }

  if (!canHrIssueCorrespondence(existing.status)) {
    throw new Error("Only draft correspondence can be issued.");
  }

  const metadata = await getAuditRequestMetadata(formData);
  const issueDate = existing.effectiveDate;
  const retentionUntil =
    existing.retentionUntil ??
    defaultRetentionUntil(existing.category, issueDate);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeCorrespondence.update({
      where: { id: existing.id },
      data: {
        status: CorrespondenceStatus.ISSUED,
        issueDate,
        issuedByUserId: actor.actor.userId,
        retentionUntil,
      },
    });

    if (existing.supersedesId) {
      await transaction.employeeCorrespondence.update({
        where: { id: existing.supersedesId },
        data: {
          status: statusAfterSupersedingIssue(),
        },
      });
    }

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "ISSUE",
        entityType: "EmployeeCorrespondence",
        entityId: existing.id,
        description: `Issued correspondence “${existing.title}” for ${existing.employee.firstName} ${existing.employee.lastName}`,
        oldValues: { status: existing.status },
        newValues: {
          status: CorrespondenceStatus.ISSUED,
          issueDate: issueDate.toISOString().slice(0, 10),
          retentionUntil: retentionUntil?.toISOString().slice(0, 10) ?? null,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  await finalizeIssuedCorrespondence(correspondenceId, employeeId);
}

export async function supersedeEmployeeCorrespondence(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      body: true,
      effectiveDate: true,
      employeeVisible: true,
      managerVisible: true,
      requiresAcknowledgement: true,
      allowsEmployeeResponse: true,
      subType: true,
      templateId: true,
      supersededBy: { select: { id: true } },
      employee: {
        select: {
          organizationId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("The correspondence record no longer exists.");
  }

  if (
    !canCreateSupersedingDraft({
      status: existing.status,
      supersededById: existing.supersededBy?.id,
    })
  ) {
    throw new Error("This letter cannot be superseded.");
  }

  const metadata = await getAuditRequestMetadata(formData);
  const today = new Date().toISOString().slice(0, 10);

  const draft = await prisma.$transaction(async (transaction) => {
    const created = await transaction.employeeCorrespondence.create({
      data: {
        organizationId: existing.employee.organizationId,
        employeeId,
        category: existing.category,
        subType: existing.subType,
        title: existing.title,
        body: existing.body,
        effectiveDate: new Date(`${today}T00:00:00.000Z`),
        status: CorrespondenceStatus.DRAFT,
        employeeVisible: existing.employeeVisible,
        managerVisible: existing.managerVisible,
        requiresAcknowledgement: existing.requiresAcknowledgement,
        allowsEmployeeResponse: existing.allowsEmployeeResponse,
        templateId: existing.templateId,
        supersedesId: existing.id,
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CREATE",
        entityType: "EmployeeCorrespondence",
        entityId: created.id,
        description: `Created superseding draft for “${existing.title}” (${existing.employee.firstName} ${existing.employee.lastName})`,
        newValues: {
          supersedesId: existing.id,
          status: CorrespondenceStatus.DRAFT,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    return created;
  });

  revalidateCorrespondencePaths(employeeId, draft.id);
  redirect(
    `/people/employees/${employeeId}/documents/${draft.id}/edit`,
  );
}

export async function sendCorrespondenceAcknowledgementReminder(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      status: true,
      requiresAcknowledgement: true,
      employeeVisible: true,
    },
  });

  if (!existing) {
    throw new Error("The correspondence record no longer exists.");
  }

  if (
    existing.status !== "ISSUED" ||
    !existing.requiresAcknowledgement ||
    !existing.employeeVisible
  ) {
    throw new Error("This letter does not have a pending acknowledgement.");
  }

  const result = await notifyCorrespondenceAcknowledgementReminders({
    correspondenceId,
    force: true,
  });

  if (result.notified === 0) {
    throw new Error(
      "No reminder was sent. The employee may not have a linked user account.",
    );
  }

  revalidateCorrespondencePaths(employeeId, correspondenceId);
}

export async function archiveEmployeeCorrespondence(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      status: true,
      title: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("The correspondence record no longer exists.");
  }

  if (!canHrArchiveCorrespondence(existing.status)) {
    throw new Error("This correspondence is already archived.");
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeCorrespondence.update({
      where: { id: existing.id },
      data: {
        status: CorrespondenceStatus.ARCHIVED,
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CLOSE",
        entityType: "EmployeeCorrespondence",
        entityId: existing.id,
        description: `Archived correspondence “${existing.title}” for ${existing.employee.firstName} ${existing.employee.lastName}`,
        oldValues: { status: existing.status },
        newValues: { status: CorrespondenceStatus.ARCHIVED },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  revalidateCorrespondencePaths(employeeId, correspondenceId);
}

export async function acknowledgeEmployeeCorrespondence(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.profile.view_own");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  if (!actor.actor.employeeId) {
    throw new Error("Your account is not linked to an employee record.");
  }

  const correspondenceId = textValue(formData, "correspondenceId");
  const employeeId = actor.actor.employeeId;

  const existing = await prisma.employeeCorrespondence.findFirst({
    where: {
      id: correspondenceId,
      employeeId,
    },
    select: {
      id: true,
      status: true,
      title: true,
      employeeVisible: true,
      requiresAcknowledgement: true,
    },
  });

  if (!existing) {
    throw new Error("The correspondence record no longer exists.");
  }

  if (!canEmployeeAcknowledgeCorrespondence(existing)) {
    throw new Error("This letter does not require acknowledgement.");
  }

  const metadata = await getAuditRequestMetadata(formData);
  const acknowledgedAt = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeCorrespondence.update({
      where: { id: existing.id },
      data: {
        status: CorrespondenceStatus.ACKNOWLEDGED,
        acknowledgedAt,
        acknowledgedByUserId: actor.actor.userId,
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "ACKNOWLEDGE",
        entityType: "EmployeeCorrespondence",
        entityId: existing.id,
        description: `Acknowledged correspondence “${existing.title}”`,
        oldValues: { status: existing.status },
        newValues: {
          status: CorrespondenceStatus.ACKNOWLEDGED,
          acknowledgedAt: acknowledgedAt.toISOString(),
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  revalidateCorrespondencePaths(employeeId, correspondenceId);
}

export async function buildCorrespondenceFromTemplate(
  employeeId: string,
  templateId: string,
): Promise<{
  category: string;
  title: string;
  body: string;
  employeeVisible: boolean;
  managerVisible: boolean;
  requiresAcknowledgement: boolean;
  allowsEmployeeResponse: boolean;
  templateId: string;
} | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      nisNumber: true,
      birNumber: true,
      position: { select: { title: true } },
      assignments: {
        where: { isCurrent: true },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          position: { select: { title: true } },
        },
      },
    },
  });

  const template = await prisma.correspondenceTemplate.findFirst({
    where: { id: templateId, isActive: true },
  });

  if (!employee || !template) {
    return null;
  }

  const positionTitle = resolveEmployeePositionTitle({
    assignmentPositionTitle: employee.assignments[0]?.position?.title,
    positionTitle: employee.position?.title,
  });

  const mergeContext = buildCorrespondenceMergeContext({
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    positionTitle,
    nisNumber: employee.nisNumber,
    birNumber: employee.birNumber,
  });

  return {
    category: template.category,
    title: applyCorrespondenceMergeFields(template.defaultTitle, mergeContext),
    body: applyCorrespondenceMergeFields(template.body, mergeContext),
    employeeVisible: template.employeeVisible,
    managerVisible: false,
    requiresAcknowledgement: template.requiresAcknowledgement,
    allowsEmployeeResponse: template.allowsEmployeeResponse,
    templateId: template.id,
  };
}

/**
 * From an issued OFFER_LETTER, create a linked Assumption of Duty draft
 * (template-based when available) that requires acknowledgement.
 */
export async function issueAssumptionOfDutyFromOffer(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const correspondenceId = textValue(formData, "correspondenceId");

  const offer = await prisma.employeeCorrespondence.findFirst({
    where: { id: correspondenceId, employeeId },
    select: {
      id: true,
      category: true,
      status: true,
      title: true,
      organizationId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          nisNumber: true,
          birNumber: true,
          position: { select: { title: true } },
          assignments: {
            where: { isCurrent: true },
            orderBy: { startDate: "desc" },
            take: 1,
            select: { position: { select: { title: true } } },
          },
        },
      },
    },
  });

  if (!offer) {
    throw new Error("The offer letter no longer exists.");
  }

  if (offer.category !== "OFFER_LETTER") {
    throw new Error("Assumption of duty can only be started from an offer letter.");
  }

  if (offer.status !== "ISSUED" && offer.status !== "ACKNOWLEDGED") {
    throw new Error("Issue the offer letter before creating assumption of duty.");
  }

  const existingLinked = await prisma.employeeCorrespondence.findFirst({
    where: {
      employeeId,
      relatedCorrespondenceId: offer.id,
      OR: [
        { title: { contains: "Assumption of Duty", mode: "insensitive" } },
        { subType: { contains: "ASSUMPTION", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existingLinked) {
    redirect(
      `/people/employees/${employeeId}/documents/${existingLinked.id}/edit`,
    );
  }

  const template = await prisma.correspondenceTemplate.findFirst({
    where: {
      organizationId: offer.organizationId,
      isActive: true,
      OR: [
        { name: { contains: "Assumption of Duty", mode: "insensitive" } },
        { defaultTitle: { contains: "Assumption of Duty", mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  const positionTitle = resolveEmployeePositionTitle({
    assignmentPositionTitle: offer.employee.assignments[0]?.position?.title,
    positionTitle: offer.employee.position?.title,
  });

  const mergeContext = buildCorrespondenceMergeContext({
    firstName: offer.employee.firstName,
    lastName: offer.employee.lastName,
    employeeNumber: offer.employee.employeeNumber,
    positionTitle,
    nisNumber: offer.employee.nisNumber,
    birNumber: offer.employee.birNumber,
  });

  const today = new Date().toISOString().slice(0, 10);
  const title = template
    ? applyCorrespondenceMergeFields(template.defaultTitle, mergeContext)
    : "Assumption of Duty";
  const body = template
    ? applyCorrespondenceMergeFields(template.body, mergeContext)
    : null;

  const metadata = await getAuditRequestMetadata(formData);

  const draft = await prisma.$transaction(async (transaction) => {
    const created = await transaction.employeeCorrespondence.create({
      data: {
        organizationId: offer.organizationId,
        employeeId,
        category: CorrespondenceCategory.GENERAL,
        subType: "ASSUMPTION_OF_DUTY",
        title,
        body,
        effectiveDate: new Date(`${today}T00:00:00.000Z`),
        status: CorrespondenceStatus.DRAFT,
        employeeVisible: true,
        managerVisible: false,
        requiresAcknowledgement: true,
        templateId: template?.id ?? null,
        relatedCorrespondenceId: offer.id,
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CREATE",
        entityType: "EmployeeCorrespondence",
        entityId: created.id,
        description: `Created assumption of duty draft from offer “${offer.title}” (${offer.employee.firstName} ${offer.employee.lastName})`,
        newValues: {
          relatedCorrespondenceId: offer.id,
          requiresAcknowledgement: true,
          status: CorrespondenceStatus.DRAFT,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    return created;
  });

  revalidateCorrespondencePaths(employeeId, draft.id);
  redirect(`/people/employees/${employeeId}/documents/${draft.id}/edit`);
}
