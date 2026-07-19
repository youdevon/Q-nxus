"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EmployeeAssignmentType } from "@/generated/prisma/client";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import {
  AssignEmployeeError,
  assignEmployeeToPosition,
  isEmployeeAssignmentType,
} from "@/src/modules/hr/services/assign-employee-to-position";

export type EmployeeAssignmentFormState = {
  status: "idle" | "error" | "conflict" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
  entityId?: string;
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

function revalidateAssignmentPaths(input: {
  employeeId: string;
  departmentId: string;
  positionId: string | null;
}) {
  revalidatePath("/people");
  revalidatePath(`/people/employees/${input.employeeId}`);
  revalidatePath(`/people/employees/${input.employeeId}/assignments`);
  revalidatePath("/people/structure");
  revalidatePath("/people/structure/chart");

  if (input.positionId) {
    revalidatePath(`/people/structure/positions/${input.positionId}`);
  }

  if (input.departmentId) {
    revalidatePath(`/people/structure/departments/${input.departmentId}`);
  }
}

export async function createEmployeeAssignment(
  _previousState: EmployeeAssignmentFormState,
  formData: FormData,
): Promise<EmployeeAssignmentFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const submittedUpdatedAt = textValue(formData, "employeeUpdatedAt");
  const departmentId = textValue(formData, "departmentId");
  const positionId = nullableText(formData, "positionId");
  const assignmentTypeValue = textValue(formData, "assignmentType");
  const startDate = parseDate(textValue(formData, "startDate"));
  const referenceNumber = nullableText(formData, "referenceNumber");
  const reason = nullableText(formData, "reason");
  const notes = nullableText(formData, "notes");
  const isActing = formData.get("isActing") === "on";
  const returnTo = nullableText(formData, "returnTo");
  const stayOnPage = formData.get("redirect") === "false";

  const fieldErrors: Record<string, string> = {};

  if (!employeeId) {
    fieldErrors.employeeId = "Select an employee.";
  }

  if (!departmentId) {
    fieldErrors.departmentId = "Select a department.";
  }

  if (!startDate) {
    fieldErrors.startDate = "Enter a valid start date.";
  }

  if (!isEmployeeAssignmentType(assignmentTypeValue)) {
    fieldErrors.assignmentType = "Select a valid assignment type.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the assignment information.",
      fieldErrors,
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const result = await assignEmployeeToPosition({
      employeeId,
      departmentId,
      positionId,
      assignmentType: assignmentTypeValue as EmployeeAssignmentType,
      startDate: startDate!,
      isActing,
      referenceNumber,
      reason,
      notes,
      expectedEmployeeUpdatedAt: submittedUpdatedAt || null,
      actorUserId: actor.actor.userId,
      audit: metadata,
    });

    revalidateAssignmentPaths({
      employeeId: result.employeeId,
      departmentId: result.departmentId,
      positionId: result.positionId,
    });

    if (stayOnPage) {
      return {
        status: "success",
        message: result.created
          ? `Assigned to ${result.positionTitle ?? result.departmentName}.`
          : "Employee is already on this position.",
        entityId: result.assignmentId || undefined,
      };
    }

    const safeReturnTo =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : null;

    redirect(safeReturnTo ?? `/people/employees/${employeeId}/assignments`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    if (error instanceof AssignEmployeeError) {
      if (error.code === "conflict") {
        return {
          status: "conflict",
          message: error.message,
        };
      }

      return {
        status: "error",
        message: error.message,
      };
    }

    console.error("Unable to create employee assignment:", error);

    return {
      status: "error",
      message: "The employee assignment could not be created.",
    };
  }
}
