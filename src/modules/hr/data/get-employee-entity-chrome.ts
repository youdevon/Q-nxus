import { prisma } from "@/lib/prisma";
import {
  resolveEmployeeLeadershipRole,
  type EmployeeLeadershipRole,
} from "@/src/modules/hr/lib/employee-leadership-role";
import { isFullEmployee } from "@/src/modules/hr/lib/workforce-category";

export type EmployeeEntityChrome = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  workforceCategory: string;
  isFullEmployee: boolean;
  leadershipRole: EmployeeLeadershipRole;
  positionTitle: string | null;
};

export async function getEmployeeEntityChrome(
  employeeId: string,
): Promise<EmployeeEntityChrome | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      middleName: true,
      workforceCategory: true,
      position: {
        select: {
          id: true,
          title: true,
          reportsToPositionId: true,
          _count: {
            select: {
              directReports: true,
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  const displayName = `${employee.firstName}${
    employee.middleName ? ` ${employee.middleName}` : ""
  } ${employee.lastName}`;

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    displayName,
    workforceCategory: employee.workforceCategory,
    isFullEmployee: isFullEmployee(employee.workforceCategory),
    positionTitle: employee.position?.title ?? null,
    leadershipRole: resolveEmployeeLeadershipRole({
      positionTitle: employee.position?.title ?? null,
      reportsToPositionId: employee.position?.reportsToPositionId ?? null,
      directReportCount: employee.position?._count.directReports ?? 0,
    }),
  };
}
