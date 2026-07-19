import {
  EmployeeAssignmentType,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { syncEmployeeAccessRoles } from "@/src/modules/auth/services/provision-employee-user";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { assertCurrentSeatMatchesAssignment } from "@/src/modules/hr/lib/current-seat";

export class AssignEmployeeError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "validation" | "invalid_selection",
  ) {
    super(message);
    this.name = "AssignEmployeeError";
  }
}

export type AssignEmployeeToPositionInput = {
  employeeId: string;
  departmentId: string;
  positionId: string | null;
  assignmentType: EmployeeAssignmentType;
  startDate: Date;
  isActing?: boolean;
  referenceNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  /** When set, rejects if the employee row was updated elsewhere. */
  expectedEmployeeUpdatedAt?: string | null;
  actorUserId: string;
  audit: AuditRequestMetadata;
};

export type AssignEmployeeToPositionResult = {
  assignmentId: string;
  employeeId: string;
  departmentId: string;
  positionId: string | null;
  positionTitle: string | null;
  departmentName: string;
  /** False when the employee was already on this seat — no new row written. */
  created: boolean;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

async function resolveJobDescriptionId(
  client: DbClient,
  positionId: string | null,
  startDate: Date,
): Promise<string | null> {
  if (!positionId) {
    return null;
  }

  const currentJobDescription = await client.positionJobDescription.findFirst({
    where: {
      positionId,
      isCurrent: true,
      status: "ACTIVE",
      effectiveFrom: {
        lte: startDate,
      },
      OR: [
        {
          effectiveUntil: null,
        },
        {
          effectiveUntil: {
            gte: startDate,
          },
        },
      ],
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      id: true,
    },
  });

  return currentJobDescription?.id ?? null;
}

/**
 * Best-effort access-role sync for an employee's linked user account.
 * Non-transactional — call after the seat change has committed.
 */
export async function syncAssignedEmployeeAccessRoles(
  employeeId: string,
): Promise<void> {
  const linkedUser = await prisma.user.findFirst({
    where: {
      employeeId,
    },
    select: {
      id: true,
    },
  });

  if (linkedUser) {
    await syncEmployeeAccessRoles(linkedUser.id, employeeId);
  }
}

/**
 * Sets an employee's current organizational seat (department + optional position)
 * by closing any current EmployeeAssignment and opening a new one, then
 * denormalizing Employee.departmentId / positionId (seat cache) and syncing the
 * live contract jobTitle snapshot from Position.
 *
 * Callers own authz and path revalidation. Use this from org assignment UI and
 * from contract create when the selected Position differs from the current seat.
 *
 * Pass `db` as an open transaction client to make the seat change atomic with
 * the caller's writes. In that case the access-role sync is skipped (it reads
 * committed data via the shared client); the caller must invoke
 * `syncAssignedEmployeeAccessRoles` after the transaction commits.
 */
export async function assignEmployeeToPosition(
  input: AssignEmployeeToPositionInput,
  db: DbClient = prisma,
): Promise<AssignEmployeeToPositionResult> {
  const employee = await db.employee.findUnique({
    where: {
      id: input.employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      updatedAt: true,
      departmentId: true,
      positionId: true,
    },
  });

  if (!employee) {
    throw new AssignEmployeeError(
      "The employee record no longer exists.",
      "not_found",
    );
  }

  if (
    input.expectedEmployeeUpdatedAt &&
    employee.updatedAt.toISOString() !== input.expectedEmployeeUpdatedAt
  ) {
    throw new AssignEmployeeError(
      "The employee record changed elsewhere. Refresh before continuing.",
      "conflict",
    );
  }

  if (input.startDate < employee.hireDate) {
    throw new AssignEmployeeError(
      "The assignment start date cannot be before the employee’s hire date.",
      "validation",
    );
  }

  const department = await db.department.findFirst({
    where: {
      id: input.departmentId,
      organizationId: employee.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!department) {
    throw new AssignEmployeeError(
      "The selected department is invalid or inactive.",
      "invalid_selection",
    );
  }

  let position: { id: string; title: string } | null = null;

  if (input.positionId) {
    position = await db.position.findFirst({
      where: {
        id: input.positionId,
        departmentId: input.departmentId,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!position) {
      throw new AssignEmployeeError(
        "The selected position does not belong to the department.",
        "invalid_selection",
      );
    }
  }

  const alreadyOnSeat =
    employee.departmentId === input.departmentId &&
    employee.positionId === (input.positionId ?? null);

  if (alreadyOnSeat) {
    const currentAssignment = await db.employeeAssignment.findFirst({
      where: {
        employeeId: input.employeeId,
        isCurrent: true,
      },
      orderBy: {
        startDate: "desc",
      },
      select: {
        id: true,
      },
    });

    return {
      assignmentId: currentAssignment?.id ?? "",
      employeeId: employee.id,
      departmentId: department.id,
      positionId: position?.id ?? null,
      positionTitle: position?.title ?? null,
      departmentName: department.name,
      created: false,
    };
  }

  const applySeatChange = async (
    transaction: Prisma.TransactionClient,
  ): Promise<string> => {
    const currentAssignment = await transaction.employeeAssignment.findFirst({
      where: {
        employeeId: input.employeeId,
        isCurrent: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    if (currentAssignment && input.startDate <= currentAssignment.startDate) {
      throw new AssignEmployeeError(
        "The new assignment must begin after the current assignment started.",
        "validation",
      );
    }

    if (currentAssignment) {
      const previousEndDate = new Date(input.startDate);
      previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);

      await transaction.employeeAssignment.update({
        where: {
          id: currentAssignment.id,
        },
        data: {
          isCurrent: false,
          endDate: previousEndDate,
        },
      });
    }

    const jobDescriptionId = await resolveJobDescriptionId(
      transaction,
      input.positionId,
      input.startDate,
    );

    const assignment = await transaction.employeeAssignment.create({
      data: {
        employeeId: input.employeeId,
        departmentId: input.departmentId,
        positionId: input.positionId,
        jobDescriptionId,
        assignmentType: input.assignmentType,
        startDate: input.startDate,
        isCurrent: true,
        isActing: input.isActing ?? false,
        referenceNumber: input.referenceNumber ?? null,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
      },
    });

    await transaction.employee.update({
      where: {
        id: input.employeeId,
      },
      data: {
        departmentId: input.departmentId,
        positionId: input.positionId,
      },
    });

    assertCurrentSeatMatchesAssignment(
      {
        departmentId: input.departmentId,
        positionId: input.positionId,
      },
      {
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
      },
    );

    if (position?.title) {
      await transaction.employmentContract.updateMany({
        where: {
          employeeId: input.employeeId,
          isCurrent: true,
        },
        data: {
          jobTitle: position.title,
        },
      });
    }

    await recordAuditEvent(transaction, {
      userId: input.actorUserId,
      organizationId: employee.organizationId,
      moduleKey: "hr",
      action: "ASSIGN",
      entityType: "EmployeeAssignment",
      entityId: assignment.id,
      description: `Assigned ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName} to ${position?.title ?? department.name}.`,
      newValues: {
        employeeId: input.employeeId,
        departmentId: input.departmentId,
        positionId: input.positionId,
        jobDescriptionId,
        assignmentType: assignment.assignmentType,
        startDate: assignment.startDate,
        isActing: assignment.isActing,
        referenceNumber: assignment.referenceNumber,
        reason: assignment.reason,
      },
      ...input.audit,
    });

    return assignment.id;
  };

  const isStandaloneClient = "$transaction" in db;
  const assignmentId = isStandaloneClient
    ? await db.$transaction(applySeatChange)
    : await applySeatChange(db);

  if (isStandaloneClient) {
    await syncAssignedEmployeeAccessRoles(input.employeeId);
  }

  return {
    assignmentId,
    employeeId: employee.id,
    departmentId: department.id,
    positionId: position?.id ?? null,
    positionTitle: position?.title ?? null,
    departmentName: department.name,
    created: true,
  };
}

export function isEmployeeAssignmentType(
  value: string,
): value is EmployeeAssignmentType {
  return Object.values(EmployeeAssignmentType).includes(
    value as EmployeeAssignmentType,
  );
}
