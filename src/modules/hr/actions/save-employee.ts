"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  EmployeeIdType,
  EmploymentStatus,
  EmploymentType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatSequenceReference } from "@/src/modules/admin/lib/numbering-sequence";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { normalizeLoginEmail } from "@/src/modules/auth/lib/employee-login-email";
import {
  EmployeeLoginEmailConflictError,
  provisionEmployeeUser,
  syncEmployeeUserLoginEmail,
} from "@/src/modules/auth/services/provision-employee-user";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import {
  isFullEmployee,
  parseWorkforceCategory,
  WorkforceCategory,
} from "@/src/modules/hr/lib/workforce-category";
import { syncHireAccessRoles } from "@/src/modules/hr/services/sync-hire-access-roles";

export type EmployeeFormState = {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string>;
};

function mapEmployeeWriteError(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const targets = Array.isArray(target)
        ? target.map(String)
        : typeof target === "string"
          ? [target]
          : [];

      if (targets.some((value) => value.includes("employeeNumber"))) {
        return "That employee number is already in use. Advance or reset the EMPLOYEE numbering sequence, then try again.";
      }

      return "An employee with these details already exists.";
    }

    if (error.code === "P2003") {
      return "The selected department or position is invalid.";
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    if (/unknown argument/i.test(error.message)) {
      return "The app is out of sync with the database schema. Restart the development server and try again.";
    }

    return "The employee details failed validation. Review the form and try again.";
  }

  if (
    error instanceof Error &&
    (error.message.includes("EMPLOYEE numbering sequence") ||
      error.message.includes("user account") ||
      error.message.includes("personal email") ||
      error.message.includes("EMPLOYEE self-service role"))
  ) {
    return error.message;
  }

  return fallback;
}

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

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateEmployee(
  formData: FormData,
  options?: { requirePersonalEmail?: boolean },
) {
  const firstName = textValue(formData, "firstName");
  const lastName = textValue(formData, "lastName");
  const workforceCategoryValue = textValue(formData, "workforceCategory");
  const workforceCategory =
    parseWorkforceCategory(workforceCategoryValue) ??
    WorkforceCategory.EMPLOYEE;
  const employmentTypeValue = textValue(formData, "employmentType");
  const employmentStatusValue = textValue(formData, "employmentStatus");
  const hireDate = parseDate(textValue(formData, "hireDate"));
  const terminationDate = parseDate(textValue(formData, "terminationDate"));
  const dateOfBirthValue = textValue(formData, "dateOfBirth");
  const dateOfBirth = parseDate(dateOfBirthValue);
  const workEmail = nullableText(formData, "workEmail");
  const personalEmail = nullableText(formData, "personalEmail");
  const nisNumber = nullableText(formData, "nisNumber");
  const birNumber = nullableText(formData, "birNumber");
  const idNumber = nullableText(formData, "idNumber");
  const idTypeValue = textValue(formData, "idType");
  const idType =
    idTypeValue &&
    Object.values(EmployeeIdType).includes(idTypeValue as EmployeeIdType)
      ? (idTypeValue as EmployeeIdType)
      : null;

  const fieldErrors: Record<string, string> = {};

  if (firstName.length < 2) {
    fieldErrors.firstName = "First name must contain at least two characters.";
  }

  if (lastName.length < 2) {
    fieldErrors.lastName = "Last name must contain at least two characters.";
  }

  if (
    workforceCategoryValue &&
    !parseWorkforceCategory(workforceCategoryValue)
  ) {
    fieldErrors.workforceCategory = "Select a valid workforce category.";
  }

  if (
    !Object.values(EmploymentType).includes(
      employmentTypeValue as EmploymentType,
    )
  ) {
    fieldErrors.employmentType = "Select a valid employment type.";
  }

  if (
    !Object.values(EmploymentStatus).includes(
      employmentStatusValue as EmploymentStatus,
    )
  ) {
    fieldErrors.employmentStatus = "Select a valid employment status.";
  }

  if (!hireDate) {
    fieldErrors.hireDate = "Enter a valid hire date.";
  }

  if (dateOfBirthValue && !dateOfBirth) {
    fieldErrors.dateOfBirth = "Enter a valid date of birth.";
  }

  if (dateOfBirth && dateOfBirth > new Date()) {
    fieldErrors.dateOfBirth = "Date of birth cannot be in the future.";
  }

  if (terminationDate && hireDate && terminationDate < hireDate) {
    fieldErrors.terminationDate =
      "Termination date cannot be before the hire date.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (workEmail && !emailPattern.test(workEmail)) {
    fieldErrors.workEmail = "Enter a valid work email address.";
  }

  if (options?.requirePersonalEmail && !personalEmail) {
    fieldErrors.personalEmail =
      "Personal email is required — it becomes the employee's login email.";
  } else if (personalEmail && !emailPattern.test(personalEmail)) {
    fieldErrors.personalEmail = "Enter a valid personal email address.";
  }

  if (idTypeValue && !idType) {
    fieldErrors.idType = "Select a valid ID type.";
  }

  if (idNumber && !idType) {
    fieldErrors.idType = "Select an ID type when an ID number is provided.";
  }

  if (idType && !idNumber) {
    fieldErrors.idNumber = "Enter an ID number when an ID type is selected.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      firstName,
      middleName: nullableText(formData, "middleName"),
      lastName,
      preferredName: nullableText(formData, "preferredName"),
      workEmail,
      personalEmail,
      phone: nullableText(formData, "phone"),
      address: nullableText(formData, "address"),
      emergencyContactName: nullableText(formData, "emergencyContactName"),
      emergencyContactPhone: nullableText(formData, "emergencyContactPhone"),
      emergencyContactRelationship: nullableText(
        formData,
        "emergencyContactRelationship",
      ),
      dateOfBirth,
      nisNumber,
      birNumber,
      idType,
      idNumber,
      workforceCategory,
      employmentType: employmentTypeValue as EmploymentType,
      employmentStatus: employmentStatusValue as EmploymentStatus,
      hireDate,
      terminationDate,
      departmentId: nullableText(formData, "departmentId"),
      positionId: nullableText(formData, "positionId"),
    },
  };
}

async function validateStructureSelection(
  organizationId: string,
  departmentId: string | null,
  positionId: string | null,
): Promise<string | null> {
  if (positionId && !departmentId) {
    return "A department must be selected for the position.";
  }

  if (!departmentId) {
    return null;
  }

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!department) {
    return "The selected department is invalid or inactive.";
  }

  if (positionId) {
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        departmentId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!position) {
      return "The selected position does not belong to the department.";
    }
  }

  return null;
}

export async function createEmployee(
  _previousState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const validation = validateEmployee(formData, {
    requirePersonalEmail: true,
  });

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the highlighted employee information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  const departmentId = isFullEmployee(validation.values.workforceCategory)
    ? validation.values.departmentId
    : null;
  const positionId = isFullEmployee(validation.values.workforceCategory)
    ? validation.values.positionId
    : null;

  const structureError = await validateStructureSelection(
    organization.id,
    departmentId,
    positionId,
  );

  if (structureError) {
    return {
      status: "error",
      message: structureError,
    };
  }

  const loginEmail = normalizeLoginEmail(validation.values.personalEmail!);
  const existingLoginUser = await prisma.user.findUnique({
    where: {
      email: loginEmail,
    },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (existingLoginUser?.employeeId) {
    return {
      status: "error",
      message:
        "That personal email is already used as a login for another employee.",
      fieldErrors: {
        personalEmail:
          "This email is already linked to another employee's user account.",
      },
    };
  }

  try {
    const metadata = await getAuditRequestMetadata(formData);

    const employee = await prisma.$transaction(async (transaction) => {
      const sequence = await transaction.numberingSequence.findFirst({
        where: {
          organizationId: organization.id,
          sequenceCode: "EMPLOYEE",
          isActive: true,
        },
      });

      if (!sequence) {
        throw new Error("The EMPLOYEE numbering sequence is not configured.");
      }

      const updatedSequence = await transaction.numberingSequence.update({
        where: {
          id: sequence.id,
        },
        data: {
          currentNumber: {
            increment: 1,
          },
          version: {
            increment: 1,
          },
        },
      });

      const employeeNumber = formatSequenceReference({
        value: updatedSequence.currentNumber,
        minimumLength: updatedSequence.minimumLength,
        prefix: updatedSequence.prefix,
        suffix: updatedSequence.suffix,
      });

      const created = await transaction.employee.create({
        data: {
          organizationId: organization.id,
          employeeNumber,
          firstName: validation.values.firstName,
          middleName: validation.values.middleName,
          lastName: validation.values.lastName,
          preferredName: validation.values.preferredName,
          workEmail: validation.values.workEmail,
          personalEmail: validation.values.personalEmail,
          phone: validation.values.phone,
          address: validation.values.address,
          emergencyContactName: validation.values.emergencyContactName,
          emergencyContactPhone: validation.values.emergencyContactPhone,
          emergencyContactRelationship:
            validation.values.emergencyContactRelationship,
          dateOfBirth: validation.values.dateOfBirth,
          nisNumber: validation.values.nisNumber,
          birNumber: validation.values.birNumber,
          idType: validation.values.idType,
          idNumber: validation.values.idNumber,
          workforceCategory: validation.values.workforceCategory,
          employmentStatus: validation.values.employmentStatus,
          employmentType: validation.values.employmentType,
          hireDate: validation.values.hireDate!,
          // Termination belongs on leavers / contract close — not at hire.
          terminationDate: null,
          departmentId,
          positionId,
        },
      });

      if (created.departmentId && isFullEmployee(created.workforceCategory)) {
        let jobDescriptionId: string | null = null;

        if (created.positionId) {
          const currentJobDescription =
            await transaction.positionJobDescription.findFirst({
              where: {
                positionId: created.positionId,
                isCurrent: true,
                status: "ACTIVE",
              },
              orderBy: {
                versionNumber: "desc",
              },
              select: {
                id: true,
              },
            });

          jobDescriptionId = currentJobDescription?.id ?? null;
        }

        await transaction.employeeAssignment.create({
          data: {
            employeeId: created.id,
            departmentId: created.departmentId,
            positionId: created.positionId,
            jobDescriptionId,
            assignmentType: "INITIAL_APPOINTMENT",
            startDate: created.hireDate,
            isCurrent: true,
            isActing: false,
            reason: "Initial organizational assignment.",
          },
        });
      }

      await provisionEmployeeUser(created.id, transaction);

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: organization.id,
        moduleKey: "hr",
        action: "CREATE",
        entityType: "Employee",
        entityId: created.id,
        description: `Created employee ${created.employeeNumber} — ${created.firstName} ${created.lastName}.`,
        newValues: {
          employeeNumber: created.employeeNumber,
          firstName: created.firstName,
          middleName: created.middleName,
          lastName: created.lastName,
          preferredName: created.preferredName,
          workEmail: created.workEmail,
          personalEmail: created.personalEmail,
          phone: created.phone,
          address: created.address,
          emergencyContactName: created.emergencyContactName,
          emergencyContactPhone: created.emergencyContactPhone,
          emergencyContactRelationship: created.emergencyContactRelationship,
          dateOfBirth: created.dateOfBirth,
          nisNumber: created.nisNumber,
          birNumber: created.birNumber,
          idType: created.idType,
          idNumber: created.idNumber,
          workforceCategory: created.workforceCategory,
          employmentStatus: created.employmentStatus,
          employmentType: created.employmentType,
          hireDate: created.hireDate,
          terminationDate: created.terminationDate,
          departmentId: created.departmentId,
          positionId: created.positionId,
          loginEmail,
        },
        ...metadata,
      });

      return created;
    });

    // Position-linked elevated roles (post-commit; same pattern as assign).
    await syncHireAccessRoles(employee.id);

    revalidatePath("/people");
    redirect(`/people/employees/${employee.id}`);
  } catch (error: unknown) {
    unstable_rethrow(error);

    console.error("Unable to create employee:", error);

    const message = mapEmployeeWriteError(
      error,
      "The employee record could not be created.",
    );

    if (
      error instanceof Error &&
      /already linked to another employee|personal email is required|EMPLOYEE self-service role/i.test(
        error.message,
      )
    ) {
      return {
        status: "error",
        message,
        fieldErrors: {
          personalEmail: message,
        },
      };
    }

    return {
      status: "error",
      message,
    };
  }
}

export async function updateEmployee(
  _previousState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");
  const validation = validateEmployee(formData);

  if (!id || !submittedUpdatedAt) {
    return {
      status: "error",
      message: "The employee record is incomplete.",
    };
  }

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the highlighted employee information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const current = await prisma.employee.findUnique({
    where: {
      id,
    },
  });

  if (!current) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    };
  }

  if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
    return {
      status: "conflict",
      message: "This employee was updated elsewhere. Refresh before saving.",
    };
  }

  try {
    const metadata = await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.employee.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          firstName: validation.values.firstName,
          middleName: validation.values.middleName,
          lastName: validation.values.lastName,
          preferredName: validation.values.preferredName,
          workEmail: validation.values.workEmail,
          personalEmail: validation.values.personalEmail,
          phone: validation.values.phone,
          address: validation.values.address,
          emergencyContactName: validation.values.emergencyContactName,
          emergencyContactPhone: validation.values.emergencyContactPhone,
          emergencyContactRelationship:
            validation.values.emergencyContactRelationship,
          dateOfBirth: validation.values.dateOfBirth,
          nisNumber: validation.values.nisNumber,
          birNumber: validation.values.birNumber,
          idType: validation.values.idType,
          idNumber: validation.values.idNumber,
          workforceCategory: validation.values.workforceCategory,
          employmentStatus: validation.values.employmentStatus,
          employmentType: validation.values.employmentType,
          hireDate: validation.values.hireDate!,
          terminationDate: validation.values.terminationDate,
        },
      });

      if (updateResult.count !== 1) {
        return false;
      }

      const updated = await transaction.employee.findUniqueOrThrow({
        where: {
          id,
        },
      });

      // Mirror NIS/BIR onto payroll profile when one exists (employee is SoT).
      await transaction.payrollProfile.updateMany({
        where: {
          employeeId: id,
        },
        data: {
          nisNumber: validation.values.nisNumber,
          birNumber: validation.values.birNumber,
        },
      });

      const linkedUser = await transaction.user.findFirst({
        where: {
          employeeId: id,
        },
        select: {
          id: true,
        },
      });

      const loginEmail = linkedUser
        ? (await syncEmployeeUserLoginEmail(linkedUser.id, id, transaction))
            .email
        : null;

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: current.organizationId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "Employee",
        entityId: updated.id,
        description: `Updated employee ${updated.employeeNumber} — ${updated.firstName} ${updated.lastName}.`,
        oldValues: {
          firstName: current.firstName,
          middleName: current.middleName,
          lastName: current.lastName,
          preferredName: current.preferredName,
          workEmail: current.workEmail,
          personalEmail: current.personalEmail,
          phone: current.phone,
          address: current.address,
          emergencyContactName: current.emergencyContactName,
          emergencyContactPhone: current.emergencyContactPhone,
          emergencyContactRelationship: current.emergencyContactRelationship,
          dateOfBirth: current.dateOfBirth,
          nisNumber: current.nisNumber,
          birNumber: current.birNumber,
          idType: current.idType,
          idNumber: current.idNumber,
          workforceCategory: current.workforceCategory,
          employmentStatus: current.employmentStatus,
          employmentType: current.employmentType,
          hireDate: current.hireDate,
          terminationDate: current.terminationDate,
          departmentId: current.departmentId,
          positionId: current.positionId,
        },
        newValues: {
          firstName: updated.firstName,
          middleName: updated.middleName,
          lastName: updated.lastName,
          preferredName: updated.preferredName,
          workEmail: updated.workEmail,
          personalEmail: updated.personalEmail,
          phone: updated.phone,
          address: updated.address,
          emergencyContactName: updated.emergencyContactName,
          emergencyContactPhone: updated.emergencyContactPhone,
          emergencyContactRelationship: updated.emergencyContactRelationship,
          dateOfBirth: updated.dateOfBirth,
          nisNumber: updated.nisNumber,
          birNumber: updated.birNumber,
          idType: updated.idType,
          idNumber: updated.idNumber,
          workforceCategory: updated.workforceCategory,
          employmentStatus: updated.employmentStatus,
          employmentType: updated.employmentType,
          hireDate: updated.hireDate,
          terminationDate: updated.terminationDate,
          departmentId: updated.departmentId,
          positionId: updated.positionId,
          loginEmail,
        },
        ...metadata,
      });

      return true;
    });

    if (!result) {
      return {
        status: "conflict",
        message: "This employee changed while being saved. Refresh the page.",
      };
    }

    revalidatePath("/people");
    revalidatePath(`/people/employees/${id}`);
    redirect(`/people/employees/${id}`);
  } catch (error: unknown) {
    unstable_rethrow(error);

    console.error("Unable to update employee:", error);

    if (
      error instanceof EmployeeLoginEmailConflictError ||
      (error instanceof Error &&
        /personal email is required|employee login email/i.test(error.message))
    ) {
      const message = mapEmployeeWriteError(
        error,
        "The employee login email could not be updated.",
      );

      return {
        status: "error",
        message,
        fieldErrors: {
          personalEmail: message,
        },
      };
    }

    return {
      status: "error",
      message: mapEmployeeWriteError(
        error,
        "The employee record could not be updated.",
      ),
    };
  }
}
