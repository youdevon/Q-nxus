"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { syncEmployeeAccessRoles } from "@/src/modules/auth/services/provision-employee-user";
import { canDeleteDepartment } from "@/src/modules/hr/lib/can-delete-department";

export type DeleteDepartmentState = {
  status: "idle" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function deleteDepartment(
  _previousState: DeleteDepartmentState,
  formData: FormData,
): Promise<DeleteDepartmentState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const departmentId = textValue(formData, "departmentId");
  const confirmed = formData.get("confirmed") === "on";

  if (!departmentId) {
    return {
      status: "error",
      message: "Department details are missing.",
    };
  }

  if (!confirmed) {
    return {
      status: "error",
      message: "Confirm that this department should be permanently deleted.",
    };
  }

  const department = await prisma.department.findUnique({
    where: {
      id: departmentId,
    },
    include: {
      positions: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          positions: true,
          employees: true,
          employeeAssignments: true,
        },
      },
    },
  });

  if (!department) {
    return {
      status: "error",
      message: "The department no longer exists.",
    };
  }

  const deletionCheck = canDeleteDepartment({
    positionCount: department._count.positions,
    employeeCount: department._count.employees,
    assignmentCount: department._count.employeeAssignments,
  });

  if (!deletionCheck.allowed) {
    return {
      status: "error",
      message: deletionCheck.reason,
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const positionIds = department.positions.map((position) => position.id);
  let unassignedEmployeeIds: string[] = [];

  try {
    await prisma.$transaction(async (transaction) => {
      const employeesToUnassign = await transaction.employee.findMany({
        where: {
          OR: [
            { departmentId: department.id },
            ...(positionIds.length > 0
              ? [{ positionId: { in: positionIds } }]
              : []),
          ],
        },
        select: {
          id: true,
        },
      });

      unassignedEmployeeIds = employeesToUnassign.map((employee) => employee.id);

      if (unassignedEmployeeIds.length > 0) {
        await transaction.employee.updateMany({
          where: {
            id: { in: unassignedEmployeeIds },
          },
          data: {
            departmentId: null,
            positionId: null,
          },
        });
      }

      // Assignment rows retain a required departmentId FK (RESTRICT), so they
      // must be removed before the department can be deleted. Contracts are
      // left intact; employees remain unassigned until reassigned.
      await transaction.employeeAssignment.deleteMany({
        where: {
          departmentId: department.id,
        },
      });

      if (positionIds.length > 0) {
        await transaction.positionJobDescription.deleteMany({
          where: {
            positionId: { in: positionIds },
          },
        });

        await transaction.position.updateMany({
          where: {
            OR: [
              { id: { in: positionIds } },
              { reportsToPositionId: { in: positionIds } },
            ],
          },
          data: {
            reportsToPositionId: null,
          },
        });

        await transaction.position.deleteMany({
          where: {
            id: { in: positionIds },
          },
        });
      }

      await transaction.department.delete({
        where: {
          id: department.id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "DELETE",
          entityType: "Department",
          entityId: department.id,
          description: `Deleted department ${department.name}.`,
          oldValues: {
            name: department.name,
            code: department.code,
            description: department.description,
            isActive: department.isActive,
            unassignedEmployeeCount: unassignedEmployeeIds.length,
            deletedPositionCount: positionIds.length,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    const linkedUsers = await prisma.user.findMany({
      where: {
        employeeId: { in: unassignedEmployeeIds },
      },
      select: {
        id: true,
        employeeId: true,
      },
    });

    for (const linkedUser of linkedUsers) {
      if (linkedUser.employeeId) {
        await syncEmployeeAccessRoles(linkedUser.id, linkedUser.employeeId);
      }
    }

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");
    revalidatePath("/people");
    revalidatePath(`/people/structure/departments/${departmentId}`);
    revalidatePath(`/people/structure/departments/${departmentId}/edit`);

    redirect("/people/structure");
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to delete department:", error);

    return {
      status: "error",
      message: "The department could not be deleted.",
    };
  }
}
