import { prisma } from "@/lib/prisma"

export type PerformanceAppraisalListRecord = {
  id: string
  appraisalNumber: string | null
  title: string
  periodStart: string
  periodEnd: string
  reviewDueDate: string | null
  status: string
  ratingScale: string
  overallScore: string | null
  maximumScore: string
  criterionCount: number
  supervisorName: string | null
  createdAt: string
  updatedAt: string
}

export type EmployeeAppraisalHistory = {
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    departmentName: string | null
    positionTitle: string | null
  }
  appraisals: PerformanceAppraisalListRecord[]
}

export async function getEmployeeAppraisalHistory(
  employeeId: string,
): Promise<EmployeeAppraisalHistory | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: {
        select: {
          name: true,
        },
      },
      position: {
        select: {
          title: true,
        },
      },
      appraisals: {
        orderBy: [
          {
            periodEnd: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          id: true,
          appraisalNumber: true,
          title: true,
          periodStart: true,
          periodEnd: true,
          reviewDueDate: true,
          status: true,
          ratingScale: true,
          overallScore: true,
          maximumScore: true,
          createdAt: true,
          updatedAt: true,
          supervisor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              criteria: true,
            },
          },
        },
      },
    },
  })

  if (!employee) {
    return null
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      departmentName: employee.department?.name ?? null,
      positionTitle: employee.position?.title ?? null,
    },
    appraisals: employee.appraisals.map((appraisal) => ({
      id: appraisal.id,
      appraisalNumber: appraisal.appraisalNumber,
      title: appraisal.title,
      periodStart: appraisal.periodStart
        .toISOString()
        .slice(0, 10),
      periodEnd: appraisal.periodEnd
        .toISOString()
        .slice(0, 10),
      reviewDueDate:
        appraisal.reviewDueDate
          ?.toISOString()
          .slice(0, 10) ?? null,
      status: appraisal.status,
      ratingScale: appraisal.ratingScale,
      overallScore:
        appraisal.overallScore?.toString() ?? null,
      maximumScore: appraisal.maximumScore.toString(),
      criterionCount: appraisal._count.criteria,
      supervisorName: appraisal.supervisor
        ? `${appraisal.supervisor.firstName} ${appraisal.supervisor.lastName}`
        : null,
      createdAt: appraisal.createdAt.toISOString(),
      updatedAt: appraisal.updatedAt.toISOString(),
    })),
  }
}

export type AppraisalCreationData = {
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    hireDate: string
  }
  assignments: {
    id: string
    assignmentType: string
    startDate: string
    endDate: string | null
    isCurrent: boolean
    departmentName: string
    positionTitle: string | null
    jobDescription: {
      id: string
      versionNumber: number
      title: string
      criteriaCount: number
      totalWeight: string
    } | null
  }[]
  supervisors: {
    id: string
    name: string
    email: string
  }[]
}

export async function getAppraisalCreationData(
  employeeId: string,
): Promise<AppraisalCreationData | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      organizationId: true,
      assignments: {
        orderBy: [
          {
            isCurrent: "desc",
          },
          {
            startDate: "desc",
          },
        ],
        select: {
          id: true,
          assignmentType: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          department: {
            select: {
              name: true,
            },
          },
          position: {
            select: {
              title: true,
            },
          },
          jobDescription: {
            select: {
              id: true,
              versionNumber: true,
              title: true,
              criteria: {
                where: {
                  isActive: true,
                },
                select: {
                  weight: true,
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

  const supervisors = await prisma.user.findMany({
    where: {
      organizationId: employee.organizationId,
      isActive: true,
    },
    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
    },
    assignments: employee.assignments.map((assignment) => ({
      id: assignment.id,
      assignmentType: assignment.assignmentType,
      startDate: assignment.startDate
        .toISOString()
        .slice(0, 10),
      endDate:
        assignment.endDate?.toISOString().slice(0, 10) ??
        null,
      isCurrent: assignment.isCurrent,
      departmentName: assignment.department.name,
      positionTitle: assignment.position?.title ?? null,
      jobDescription: assignment.jobDescription
        ? {
            id: assignment.jobDescription.id,
            versionNumber:
              assignment.jobDescription.versionNumber,
            title: assignment.jobDescription.title,
            criteriaCount:
              assignment.jobDescription.criteria.length,
            totalWeight:
              assignment.jobDescription.criteria
                .reduce(
                  (total, criterion) =>
                    total + Number(criterion.weight),
                  0,
                )
                .toFixed(2),
          }
        : null,
    })),
    supervisors: supervisors.map((supervisor) => ({
      id: supervisor.id,
      name: `${supervisor.firstName} ${supervisor.lastName}`,
      email: supervisor.email,
    })),
  }
}

export type PerformanceAppraisalProfile = {
  id: string
  appraisalNumber: string | null
  title: string
  periodStart: string
  periodEnd: string
  reviewDueDate: string | null
  status: string
  ratingScale: string
  overallScore: string | null
  maximumScore: string
  employeeComments: string | null
  supervisorComments: string | null
  developmentPlan: string | null
  createdAt: string
  updatedAt: string
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
  }
  assignment: {
    id: string
    assignmentType: string
    departmentName: string
    positionTitle: string | null
  } | null
  jobDescription: {
    id: string
    versionNumber: number
    title: string
  } | null
  supervisor: {
    id: string
    name: string
    email: string
  } | null
  criteria: {
    id: string
    sourceCriterionId: string | null
    criterionType: string
    title: string
    description: string | null
    measurement: string | null
    weight: string
    sortOrder: number
    employeeRating: string | null
    supervisorRating: string | null
    finalRating: string | null
    weightedScore: string | null
    employeeComments: string | null
    supervisorComments: string | null
    evidence: string | null
  }[]
}

export async function getPerformanceAppraisalProfile(
  employeeId: string,
  appraisalId: string,
): Promise<PerformanceAppraisalProfile | null> {
  const appraisal = await prisma.performanceAppraisal.findFirst({
    where: {
      id: appraisalId,
      employeeId,
    },
    select: {
      id: true,
      appraisalNumber: true,
      title: true,
      periodStart: true,
      periodEnd: true,
      reviewDueDate: true,
      status: true,
      ratingScale: true,
      overallScore: true,
      maximumScore: true,
      employeeComments: true,
      supervisorComments: true,
      developmentPlan: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      assignment: {
        select: {
          id: true,
          assignmentType: true,
          department: {
            select: {
              name: true,
            },
          },
          position: {
            select: {
              title: true,
            },
          },
        },
      },
      jobDescription: {
        select: {
          id: true,
          versionNumber: true,
          title: true,
        },
      },
      supervisor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      criteria: {
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
        select: {
          id: true,
          sourceCriterionId: true,
          criterionType: true,
          title: true,
          description: true,
          measurement: true,
          weight: true,
          sortOrder: true,
          employeeRating: true,
          supervisorRating: true,
          finalRating: true,
          weightedScore: true,
          employeeComments: true,
          supervisorComments: true,
          evidence: true,
        },
      },
    },
  })

  if (!appraisal) {
    return null
  }

  return {
    id: appraisal.id,
    appraisalNumber: appraisal.appraisalNumber,
    title: appraisal.title,
    periodStart: appraisal.periodStart
      .toISOString()
      .slice(0, 10),
    periodEnd: appraisal.periodEnd
      .toISOString()
      .slice(0, 10),
    reviewDueDate:
      appraisal.reviewDueDate
        ?.toISOString()
        .slice(0, 10) ?? null,
    status: appraisal.status,
    ratingScale: appraisal.ratingScale,
    overallScore: appraisal.overallScore?.toString() ?? null,
    maximumScore: appraisal.maximumScore.toString(),
    employeeComments: appraisal.employeeComments,
    supervisorComments: appraisal.supervisorComments,
    developmentPlan: appraisal.developmentPlan,
    createdAt: appraisal.createdAt.toISOString(),
    updatedAt: appraisal.updatedAt.toISOString(),
    employee: appraisal.employee,
    assignment: appraisal.assignment
      ? {
          id: appraisal.assignment.id,
          assignmentType: appraisal.assignment.assignmentType,
          departmentName:
            appraisal.assignment.department.name,
          positionTitle:
            appraisal.assignment.position?.title ?? null,
        }
      : null,
    jobDescription: appraisal.jobDescription,
    supervisor: appraisal.supervisor
      ? {
          id: appraisal.supervisor.id,
          name: `${appraisal.supervisor.firstName} ${appraisal.supervisor.lastName}`,
          email: appraisal.supervisor.email,
        }
      : null,
    criteria: appraisal.criteria.map((criterion) => ({
      ...criterion,
      criterionType: criterion.criterionType,
      weight: criterion.weight.toString(),
      employeeRating:
        criterion.employeeRating?.toString() ?? null,
      supervisorRating:
        criterion.supervisorRating?.toString() ?? null,
      finalRating: criterion.finalRating?.toString() ?? null,
      weightedScore:
        criterion.weightedScore?.toString() ?? null,
    })),
  }
}
