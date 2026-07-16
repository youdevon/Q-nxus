import { prisma } from "@/lib/prisma"

export type ResolvedEmployeeSupervisor = {
  employeeId: string
  assignmentId: string | null
  employeePositionId: string
  employeePositionTitle: string
  supervisorPositionId: string
  supervisorPositionTitle: string
  supervisorEmployeeId: string | null
  supervisorEmployeeName: string | null
  supervisorEmployeeNumber: string | null
  supervisorUserId: string | null
  supervisorUserEmail: string | null
  supervisorUserName: string | null
  isActingSupervisor: boolean
  resolutionIssue:
    | null
    | "NO_POSITION"
    | "NO_REPORTING_LINE"
    | "SUPERVISOR_POSITION_VACANT"
    | "SUPERVISOR_USER_MISSING"
}

type SupervisorHolder = {
  isActing: boolean
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      isActive: boolean
    } | null
  }
}

function pickSupervisorHolder(
  holders: SupervisorHolder[],
): SupervisorHolder | null {
  if (holders.length === 0) {
    return null
  }

  const withActiveUser = holders.find(
    (holder) => holder.employee.user?.isActive,
  )

  if (withActiveUser) {
    return withActiveUser
  }

  return holders[0] ?? null
}

export async function resolveEmployeeSupervisor(
  employeeId: string,
): Promise<ResolvedEmployeeSupervisor | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      positionId: true,
      position: {
        select: {
          id: true,
          title: true,
          reportsToPositionId: true,
          reportsToPosition: {
            select: {
              id: true,
              title: true,
              assignments: {
                where: {
                  isCurrent: true,
                },
                orderBy: [
                  {
                    isActing: "desc",
                  },
                  {
                    startDate: "desc",
                  },
                ],
                select: {
                  isActing: true,
                  employee: {
                    select: {
                      id: true,
                      employeeNumber: true,
                      firstName: true,
                      lastName: true,
                      user: {
                        select: {
                          id: true,
                          email: true,
                          firstName: true,
                          lastName: true,
                          isActive: true,
                        },
                      },
                    },
                  },
                },
              },
              employees: {
                where: {
                  isArchived: false,
                  employmentStatus: {
                    in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"],
                  },
                },
                select: {
                  id: true,
                  employeeNumber: true,
                  firstName: true,
                  lastName: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      assignments: {
        where: {
          isCurrent: true,
          positionId: {
            not: null,
          },
        },
        orderBy: [
          {
            isActing: "desc",
          },
          {
            startDate: "desc",
          },
        ],
        take: 1,
        select: {
          id: true,
          positionId: true,
          position: {
            select: {
              id: true,
              title: true,
              reportsToPositionId: true,
              reportsToPosition: {
                select: {
                  id: true,
                  title: true,
                  assignments: {
                    where: {
                      isCurrent: true,
                    },
                    orderBy: [
                      {
                        isActing: "desc",
                      },
                      {
                        startDate: "desc",
                      },
                    ],
                    select: {
                      isActing: true,
                      employee: {
                        select: {
                          id: true,
                          employeeNumber: true,
                          firstName: true,
                          lastName: true,
                          user: {
                            select: {
                              id: true,
                              email: true,
                              firstName: true,
                              lastName: true,
                              isActive: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  employees: {
                    where: {
                      isArchived: false,
                      employmentStatus: {
                        in: [
                          "ACTIVE",
                          "ON_LEAVE",
                          "SUSPENDED",
                        ],
                      },
                    },
                    select: {
                      id: true,
                      employeeNumber: true,
                      firstName: true,
                      lastName: true,
                      user: {
                        select: {
                          id: true,
                          email: true,
                          firstName: true,
                          lastName: true,
                          isActive: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!employee) {
    return null
  }

  const assignment = employee.assignments[0] ?? null
  const employeePosition =
    assignment?.position ?? employee.position

  if (!employeePosition) {
    return {
      employeeId,
      assignmentId: assignment?.id ?? null,
      employeePositionId: "",
      employeePositionTitle: "",
      supervisorPositionId: "",
      supervisorPositionTitle: "",
      supervisorEmployeeId: null,
      supervisorEmployeeName: null,
      supervisorEmployeeNumber: null,
      supervisorUserId: null,
      supervisorUserEmail: null,
      supervisorUserName: null,
      isActingSupervisor: false,
      resolutionIssue: "NO_POSITION",
    }
  }

  const supervisorPosition =
    employeePosition.reportsToPosition

  if (!supervisorPosition) {
    return {
      employeeId,
      assignmentId: assignment?.id ?? null,
      employeePositionId: employeePosition.id,
      employeePositionTitle: employeePosition.title,
      supervisorPositionId: "",
      supervisorPositionTitle: "",
      supervisorEmployeeId: null,
      supervisorEmployeeName: null,
      supervisorEmployeeNumber: null,
      supervisorUserId: null,
      supervisorUserEmail: null,
      supervisorUserName: null,
      isActingSupervisor: false,
      resolutionIssue: "NO_REPORTING_LINE",
    }
  }

  const assignmentHolders: SupervisorHolder[] =
    supervisorPosition.assignments.map((item) => ({
      isActing: item.isActing,
      employee: item.employee,
    }))

  const employeeHolders: SupervisorHolder[] =
    supervisorPosition.employees
      .filter(
        (holder) =>
          !assignmentHolders.some(
            (assigned) =>
              assigned.employee.id === holder.id,
          ),
      )
      .map((holder) => ({
        isActing: false,
        employee: holder,
      }))

  const holder = pickSupervisorHolder([
    ...assignmentHolders,
    ...employeeHolders,
  ])

  if (!holder) {
    return {
      employeeId,
      assignmentId: assignment?.id ?? null,
      employeePositionId: employeePosition.id,
      employeePositionTitle: employeePosition.title,
      supervisorPositionId: supervisorPosition.id,
      supervisorPositionTitle: supervisorPosition.title,
      supervisorEmployeeId: null,
      supervisorEmployeeName: null,
      supervisorEmployeeNumber: null,
      supervisorUserId: null,
      supervisorUserEmail: null,
      supervisorUserName: null,
      isActingSupervisor: false,
      resolutionIssue: "SUPERVISOR_POSITION_VACANT",
    }
  }

  const supervisorUser = holder.employee.user?.isActive
    ? holder.employee.user
    : null

  return {
    employeeId,
    assignmentId: assignment?.id ?? null,
    employeePositionId: employeePosition.id,
    employeePositionTitle: employeePosition.title,
    supervisorPositionId: supervisorPosition.id,
    supervisorPositionTitle: supervisorPosition.title,
    supervisorEmployeeId: holder.employee.id,
    supervisorEmployeeName: `${holder.employee.firstName} ${holder.employee.lastName}`,
    supervisorEmployeeNumber: holder.employee.employeeNumber,
    supervisorUserId: supervisorUser?.id ?? null,
    supervisorUserEmail: supervisorUser?.email ?? null,
    supervisorUserName: supervisorUser
      ? `${supervisorUser.firstName} ${supervisorUser.lastName}`
      : null,
    isActingSupervisor: holder.isActing,
    resolutionIssue: supervisorUser
      ? null
      : "SUPERVISOR_USER_MISSING",
  }
}

export function describeSupervisorResolutionIssue(
  supervisor: ResolvedEmployeeSupervisor | null,
): string {
  if (!supervisor) {
    return "A supervisor could not be resolved for your current assignment."
  }

  switch (supervisor.resolutionIssue) {
    case "NO_POSITION":
      return "You must be assigned to a position before leave can be submitted."
    case "NO_REPORTING_LINE":
      return `Your position (${supervisor.employeePositionTitle}) has no reporting line. Set who it reports to under People → Structure → position reporting.`
    case "SUPERVISOR_POSITION_VACANT":
      return `Your reporting line points to ${supervisor.supervisorPositionTitle}, but that position has no assigned employee.`
    case "SUPERVISOR_USER_MISSING":
      return `Your supervisor is ${supervisor.supervisorEmployeeName} (${supervisor.supervisorPositionTitle}), but they do not have a linked user account. Link a user under Administration → Access so leave can be approved.`
    default:
      return "A supervisor with a linked user account is required before leave can be submitted."
  }
}
