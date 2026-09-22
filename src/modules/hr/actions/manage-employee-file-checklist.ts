"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  type EmployeeFileChecklistItemType,
  EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES,
  allowsNotApplicable,
  checklistCredentialDefaultName,
  supportsCredentialUpload,
} from "@/src/modules/hr/lib/employee-file-checklist";
import {
  deleteEmployeeFileAttachment,
  storeEmployeeFileAttachment,
} from "@/src/modules/hr/lib/store-employee-file-attachment";

export type ChecklistActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseItemType(
  value: string,
): EmployeeFileChecklistItemType | null {
  return EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES.includes(
    value as EmployeeFileChecklistItemType,
  )
    ? (value as EmployeeFileChecklistItemType)
    : null;
}

function revalidateChecklistPaths(employeeId: string) {
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
  revalidatePath("/me");
}

async function requireManageEmployee(employeeId: string) {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { ok: false as const, message: actor.message };
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
    return { ok: false as const, message: "Employee not found." };
  }

  return { ok: true as const, userId: actor.actor.userId, employee };
}

async function upsertChecklistRow(input: {
  organizationId: string;
  employeeId: string;
  itemType: EmployeeFileChecklistItemType;
  data: Record<string, unknown>;
}) {
  return prisma.employeeFileChecklistItem.upsert({
    where: {
      employeeId_itemType: {
        employeeId: input.employeeId,
        itemType: input.itemType,
      },
    },
    create: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      itemType: input.itemType,
      ...input.data,
    },
    update: input.data,
    select: { id: true },
  });
}

export async function setChecklistItemNotApplicable(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const employeeId = textValue(formData, "employeeId");
  const itemType = parseItemType(textValue(formData, "itemType"));
  const notApplicable = textValue(formData, "notApplicable") === "1";

  if (!employeeId || !itemType) {
    return { status: "error", message: "Missing checklist item." };
  }

  if (!allowsNotApplicable(itemType)) {
    return {
      status: "error",
      message: "This checklist item cannot be marked not applicable.",
    };
  }

  const access = await requireManageEmployee(employeeId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  await getAuditRequestMetadata(formData);

  await upsertChecklistRow({
    organizationId: access.employee.organizationId,
    employeeId: access.employee.id,
    itemType,
    data: {
      notApplicable,
      ...(notApplicable
        ? {
            assumptionOfDutySignedAt: null,
            assumptionOfDutyConfirmedByUserId: null,
          }
        : {}),
    },
  });

  revalidateChecklistPaths(employeeId);
  return {
    status: "success",
    message: notApplicable
      ? "Marked not applicable."
      : "Marked applicable again.",
  };
}

export async function markAssumptionOfDutySigned(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const employeeId = textValue(formData, "employeeId");
  const clear = textValue(formData, "clear") === "1";

  if (!employeeId) {
    return { status: "error", message: "Missing employee." };
  }

  const access = await requireManageEmployee(employeeId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  await getAuditRequestMetadata(formData);

  await upsertChecklistRow({
    organizationId: access.employee.organizationId,
    employeeId: access.employee.id,
    itemType: "ASSUMPTION_OF_DUTY",
    data: clear
      ? {
          assumptionOfDutySignedAt: null,
          assumptionOfDutyConfirmedByUserId: null,
          notApplicable: false,
        }
      : {
          assumptionOfDutySignedAt: new Date(),
          assumptionOfDutyConfirmedByUserId: access.userId,
          notApplicable: false,
        },
  });

  revalidateChecklistPaths(employeeId);
  return {
    status: "success",
    message: clear
      ? "Cleared assumption of duty confirmation."
      : "Marked assumption of duty as signed.",
  };
}

export async function uploadChecklistCredentialDocument(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const employeeId = textValue(formData, "employeeId");
  const itemType = parseItemType(textValue(formData, "itemType"));
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!employeeId || !itemType) {
    return { status: "error", message: "Missing checklist item." };
  }

  if (!supportsCredentialUpload(itemType)) {
    return {
      status: "error",
      message: "This item does not support credential uploads.",
    };
  }

  if (!attachmentFile) {
    return { status: "error", message: "Choose a file to upload." };
  }

  const access = await requireManageEmployee(employeeId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  await getAuditRequestMetadata(formData);
  const credentialName = checklistCredentialDefaultName(itemType);
  let previousCredentialStorageKey: string | null = null;

  try {
    await prisma.$transaction(async (transaction) => {
      const existingChecklist =
        await transaction.employeeFileChecklistItem.findUnique({
          where: {
            employeeId_itemType: {
              employeeId: access.employee.id,
              itemType,
            },
          },
          select: { credentialId: true },
        });

      let credentialId = existingChecklist?.credentialId ?? null;

      if (credentialId) {
        const existing = await transaction.employeeCredential.findFirst({
          where: { id: credentialId, employeeId: access.employee.id },
          select: { id: true, storageKey: true },
        });
        if (!existing) {
          credentialId = null;
        } else {
          previousCredentialStorageKey = existing.storageKey;
        }
      }

      if (!credentialId) {
        const namedMatch = await transaction.employeeCredential.findFirst({
          where: {
            employeeId: access.employee.id,
            name: credentialName,
          },
          select: { id: true },
        });
        credentialId = namedMatch?.id ?? null;
      }

      if (!credentialId) {
        const created = await transaction.employeeCredential.create({
          data: {
            organizationId: access.employee.organizationId,
            employeeId: access.employee.id,
            name: credentialName,
            employeeVisible: true,
          },
          select: { id: true },
        });
        credentialId = created.id;
      }

      const stored = await storeEmployeeFileAttachment({
        employee: access.employee,
        recordType: "credentials",
        recordId: credentialId,
        file: attachmentFile,
      });

      await transaction.employeeCredential.update({
        where: { id: credentialId },
        data: {
          fileName: stored.fileName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
        },
      });

      await transaction.employeeFileChecklistItem.upsert({
        where: {
          employeeId_itemType: {
            employeeId: access.employee.id,
            itemType,
          },
        },
        create: {
          organizationId: access.employee.organizationId,
          employeeId: access.employee.id,
          itemType,
          credentialId,
          notApplicable: false,
          employeeVisible: true,
        },
        update: {
          credentialId,
          notApplicable: false,
        },
      });
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to upload document.",
    };
  }

  if (previousCredentialStorageKey) {
    await deleteEmployeeFileAttachment(previousCredentialStorageKey);
  }

  revalidateChecklistPaths(employeeId);
  return { status: "success", message: "Document uploaded." };
}

export async function uploadChecklistDirectAttachment(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const employeeId = textValue(formData, "employeeId");
  const itemType = parseItemType(textValue(formData, "itemType"));
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!employeeId || !itemType) {
    return { status: "error", message: "Missing checklist item." };
  }

  if (itemType !== "ASSUMPTION_OF_DUTY") {
    return {
      status: "error",
      message: "Direct upload is only available for assumption of duty forms.",
    };
  }

  if (!attachmentFile) {
    return { status: "error", message: "Choose a file to upload." };
  }

  const access = await requireManageEmployee(employeeId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  await getAuditRequestMetadata(formData);

  try {
    const row = await upsertChecklistRow({
      organizationId: access.employee.organizationId,
      employeeId: access.employee.id,
      itemType,
      data: {
        notApplicable: false,
      },
    });

    const previousStorageKey = (
      await prisma.employeeFileChecklistItem.findUnique({
        where: { id: row.id },
        select: { storageKey: true },
      })
    )?.storageKey;

    const stored = await storeEmployeeFileAttachment({
      employee: access.employee,
      recordType: "checklist",
      recordId: row.id,
      file: attachmentFile,
    });

    await prisma.employeeFileChecklistItem.update({
      where: { id: row.id },
      data: {
        fileName: stored.fileName,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        assumptionOfDutySignedAt: new Date(),
        assumptionOfDutyConfirmedByUserId: access.userId,
      },
    });

    if (previousStorageKey) {
      await deleteEmployeeFileAttachment(previousStorageKey);
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to upload document.",
    };
  }

  revalidateChecklistPaths(employeeId);
  return { status: "success", message: "Signed form uploaded." };
}
