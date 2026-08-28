import { prisma } from "@/lib/prisma";

export type WorkflowPositionOption = {
  id: string;
  title: string;
  code: string | null;
  departmentName: string;
  holderName: string | null;
};

/**
 * Active positions for leave/contract workflow approver dropdowns.
 * Uses two flat queries instead of a nested current-assignment include per row.
 */
export async function getWorkflowPositionOptions(
  organizationId: string,
): Promise<WorkflowPositionOption[]> {
  const positions = await prisma.position.findMany({
    where: {
      isActive: true,
      department: {
        organizationId,
        isActive: true,
      },
    },
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      code: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  });

  if (positions.length === 0) {
    return [];
  }

  const holders = await prisma.employeeAssignment.findMany({
    where: {
      isCurrent: true,
      positionId: {
        in: positions.map((position) => position.id),
      },
    },
    select: {
      positionId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const holderByPositionId = new Map<string, string>();
  for (const assignment of holders) {
    if (
      assignment.positionId == null ||
      holderByPositionId.has(assignment.positionId)
    ) {
      continue;
    }
    holderByPositionId.set(
      assignment.positionId,
      `${assignment.employee.firstName} ${assignment.employee.lastName}`,
    );
  }

  return positions.map((position) => ({
    id: position.id,
    title: position.title,
    code: position.code,
    departmentName: position.department.name,
    holderName: holderByPositionId.get(position.id) ?? null,
  }));
}
