"use server";

import { revalidatePath } from "next/cache";

import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import {
  EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES,
  type EmployeeFileChecklistItemType,
} from "@/src/modules/hr/lib/employee-file-checklist";
import { sendMissingFileReminders } from "@/src/modules/hr/services/notify-missing-file-reminder";

export type MissingFileReminderActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialIdle: MissingFileReminderActionState = {
  status: "idle",
  message: "",
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isChecklistItemType(
  value: string,
): value is EmployeeFileChecklistItemType {
  return (EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES as readonly string[]).includes(
    value,
  );
}

async function resolveListedEmployees(formData: FormData) {
  const departmentId = textValue(formData, "departmentId") || null;
  const itemTypeRaw = textValue(formData, "itemType");
  const itemType =
    itemTypeRaw && isChecklistItemType(itemTypeRaw) ? itemTypeRaw : null;
  const singleEmployeeId = textValue(formData, "employeeId") || null;

  const rows = await getOrgEmployeeFileCompleteness({
    departmentId,
    itemType,
    incompleteOnly: true,
  });

  if (singleEmployeeId) {
    return rows.filter((row) => row.employeeId === singleEmployeeId);
  }

  return rows;
}

export async function remindMissingFileEmployee(
  _prev: MissingFileReminderActionState,
  formData: FormData,
): Promise<MissingFileReminderActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }
  await getAuditRequestMetadata(formData);

  const employeeId = textValue(formData, "employeeId");
  if (!employeeId) {
    return { status: "error", message: "Employee is required." };
  }

  const rows = await resolveListedEmployees(formData);
  const target = rows.find((row) => row.employeeId === employeeId);

  if (!target) {
    return {
      status: "error",
      message: "Employee is not on the current missing-docs list.",
    };
  }

  const result = await sendMissingFileReminders({
    employeeIds: [employeeId],
    missingLabelsByEmployee: new Map([
      [employeeId, target.completeness.missingLabels],
    ]),
  });

  revalidatePath("/people/documents/missing");

  if (result.notified === 1) {
    return { status: "success", message: "Reminder sent." };
  }

  if (result.skippedDedupe === 1) {
    return {
      status: "success",
      message: "Reminder already sent within the last 14 days.",
    };
  }

  if (result.skippedNoUser === 1) {
    return {
      status: "error",
      message: "No linked user account for this employee.",
    };
  }

  return { status: "error", message: "Could not send reminder." };
}

export async function remindAllMissingFileEmployees(
  _prev: MissingFileReminderActionState,
  formData: FormData,
): Promise<MissingFileReminderActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }
  await getAuditRequestMetadata(formData);

  const rows = await resolveListedEmployees(formData);

  if (rows.length === 0) {
    return { status: "error", message: "No employees match the current filters." };
  }

  const result = await sendMissingFileReminders({
    employeeIds: rows.map((row) => row.employeeId),
    missingLabelsByEmployee: new Map(
      rows.map((row) => [row.employeeId, row.completeness.missingLabels]),
    ),
  });

  revalidatePath("/people/documents/missing");

  return {
    status: "success",
    message: `Reminders: ${result.notified} sent, ${result.skippedDedupe} skipped (recent), ${result.skippedNoUser} without user.`,
  };
}

export { initialIdle as missingFileReminderInitialState };
