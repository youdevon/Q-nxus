import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import {
  resolveEmployeeLeadershipRole,
  type EmployeeLeadershipRole,
} from "@/src/modules/hr/lib/employee-leadership-role";

export type MeChromeData = {
  displayName: string;
  employeeNumber: string | null;
  workforceCategory: string | null;
  positionTitle: string | null;
  employmentStatus: string | null;
  employmentType: string | null;
  leadershipRole: EmployeeLeadershipRole;
};

/**
 * Slim self-service chrome for `/me` layout — cached per request.
 */
export const getMeChrome = cache(async (): Promise<MeChromeData> => {
  const capabilities = await requireAuthenticatedCapabilities();

  const empty: MeChromeData = {
    displayName: "My Profile",
    employeeNumber: null,
    workforceCategory: null,
    positionTitle: null,
    employmentStatus: null,
    employmentType: null,
    leadershipRole: resolveEmployeeLeadershipRole({
      positionTitle: null,
      reportsToPositionId: null,
      directReportCount: 0,
    }),
  };

  if (!capabilities.employeeId) {
    return empty;
  }

  const employee = await prisma.employee.findUnique({
    where: { id: capabilities.employeeId },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      preferredName: true,
      employeeNumber: true,
      workforceCategory: true,
      employmentStatus: true,
      employmentType: true,
      position: {
        select: {
          title: true,
          reportsToPositionId: true,
          _count: {
            select: { directReports: true },
          },
        },
      },
      assignments: {
        where: { isCurrent: true },
        take: 1,
        select: {
          position: {
            select: {
              title: true,
              reportsToPositionId: true,
              _count: {
                select: { directReports: true },
              },
            },
          },
        },
      },
      contracts: {
        where: { isCurrent: true },
        take: 1,
        select: { jobTitle: true },
      },
    },
  });

  if (!employee) {
    return empty;
  }

  const assignmentPosition = employee.assignments[0]?.position ?? null;
  const positionTitle = resolveEmployeePositionTitle({
    assignmentPositionTitle: assignmentPosition?.title ?? null,
    positionTitle: employee.position?.title ?? null,
    contractJobTitle: employee.contracts[0]?.jobTitle ?? null,
  });

  return {
    displayName:
      employee.preferredName?.trim() ||
      `${employee.firstName}${
        employee.middleName ? ` ${employee.middleName}` : ""
      } ${employee.lastName}`,
    employeeNumber: employee.employeeNumber,
    workforceCategory: employee.workforceCategory,
    positionTitle,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    leadershipRole: resolveEmployeeLeadershipRole({
      positionTitle:
        assignmentPosition?.title ?? employee.position?.title ?? null,
      reportsToPositionId:
        assignmentPosition?.reportsToPositionId ??
        employee.position?.reportsToPositionId ??
        null,
      directReportCount:
        assignmentPosition?._count.directReports ??
        employee.position?._count.directReports ??
        0,
    }),
  };
});
