import { prisma } from "@/lib/prisma"

export type JobDescriptionCriterionRecord = {
  id: string
  criterionType: string
  title: string
  description: string | null
  measurement: string | null
  weight: string
  sortOrder: number
  isActive: boolean
}

export type JobDescriptionRecord = {
  id: string
  positionId: string
  versionNumber: number
  title: string
  summary: string | null
  positionPurpose: string | null
  reportsTo: string | null
  supervisoryResponsibility: string | null
  qualifications: string | null
  requiredExperience: string | null
  status: string
  effectiveFrom: string
  effectiveUntil: string | null
  isCurrent: boolean
  updatedAt: string
  criteria: JobDescriptionCriterionRecord[]
}

export type PositionJobDescriptionData = {
  position: {
    id: string
    title: string
    code: string | null
    department: {
      id: string
      name: string
    }
  }
  jobDescriptions: JobDescriptionRecord[]
}

export async function getPositionJobDescriptions(
  positionId: string,
): Promise<PositionJobDescriptionData | null> {
  const position = await prisma.position.findUnique({
    where: {
      id: positionId,
    },
    select: {
      id: true,
      title: true,
      code: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      jobDescriptions: {
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          id: true,
          positionId: true,
          versionNumber: true,
          title: true,
          summary: true,
          positionPurpose: true,
          reportsTo: true,
          supervisoryResponsibility: true,
          qualifications: true,
          requiredExperience: true,
          status: true,
          effectiveFrom: true,
          effectiveUntil: true,
          isCurrent: true,
          updatedAt: true,
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
              criterionType: true,
              title: true,
              description: true,
              measurement: true,
              weight: true,
              sortOrder: true,
              isActive: true,
            },
          },
        },
      },
    },
  })

  if (!position) {
    return null
  }

  return {
    position: {
      id: position.id,
      title: position.title,
      code: position.code,
      department: position.department,
    },
    jobDescriptions: position.jobDescriptions.map((item) => ({
      ...item,
      status: item.status,
      effectiveFrom: item.effectiveFrom
        .toISOString()
        .slice(0, 10),
      effectiveUntil:
        item.effectiveUntil?.toISOString().slice(0, 10) ?? null,
      updatedAt: item.updatedAt.toISOString(),
      criteria: item.criteria.map((criterion) => ({
        ...criterion,
        criterionType: criterion.criterionType,
        weight: criterion.weight.toString(),
      })),
    })),
  }
}

export async function getJobDescriptionById(
  positionId: string,
  jobDescriptionId: string,
): Promise<{
  position: PositionJobDescriptionData["position"]
  jobDescription: JobDescriptionRecord
} | null> {
  const data = await getPositionJobDescriptions(positionId)

  if (!data) {
    return null
  }

  const jobDescription = data.jobDescriptions.find(
    (item) => item.id === jobDescriptionId,
  )

  if (!jobDescription) {
    return null
  }

  return {
    position: data.position,
    jobDescription,
  }
}

export async function getEmployeeCurrentJobDescription(
  employeeId: string,
) {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      position: {
        select: {
          id: true,
          title: true,
          code: true,
          department: {
            select: {
              name: true,
            },
          },
          jobDescriptions: {
            where: {
              isCurrent: true,
              status: "ACTIVE",
            },
            take: 1,
            orderBy: {
              effectiveFrom: "desc",
            },
            select: {
              id: true,
              versionNumber: true,
              title: true,
              summary: true,
              positionPurpose: true,
              reportsTo: true,
              supervisoryResponsibility: true,
              qualifications: true,
              requiredExperience: true,
              effectiveFrom: true,
              effectiveUntil: true,
              criteria: {
                where: {
                  isActive: true,
                },
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
                  criterionType: true,
                  title: true,
                  description: true,
                  measurement: true,
                  weight: true,
                  sortOrder: true,
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

  const jobDescription =
    employee.position?.jobDescriptions[0] ?? null

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
    position: employee.position
      ? {
          id: employee.position.id,
          title: employee.position.title,
          code: employee.position.code,
          department: employee.position.department.name,
        }
      : null,
    jobDescription: jobDescription
      ? {
          ...jobDescription,
          effectiveFrom: jobDescription.effectiveFrom
            .toISOString()
            .slice(0, 10),
          effectiveUntil:
            jobDescription.effectiveUntil
              ?.toISOString()
              .slice(0, 10) ?? null,
          criteria: jobDescription.criteria.map((criterion) => ({
            ...criterion,
            criterionType: criterion.criterionType,
            weight: criterion.weight.toString(),
          })),
        }
      : null,
  }
}


export type JobDescriptionLifecycleItem = {
  id: string
  versionNumber: number
  title: string
  status: string
  isCurrent: boolean
  effectiveFrom: string
  effectiveUntil: string | null
  updatedAt: string
  criterionCount: number
  totalAppraisalWeight: number
}

export type JobDescriptionLifecycleData = {
  position: PositionJobDescriptionData["position"]
  versions: JobDescriptionLifecycleItem[]
}

export async function getJobDescriptionLifecycle(
  positionId: string,
): Promise<JobDescriptionLifecycleData | null> {
  const position = await prisma.position.findUnique({
    where: {
      id: positionId,
    },
    select: {
      id: true,
      title: true,
      code: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      jobDescriptions: {
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          id: true,
          versionNumber: true,
          title: true,
          status: true,
          isCurrent: true,
          effectiveFrom: true,
          effectiveUntil: true,
          updatedAt: true,
          criteria: {
            select: {
              criterionType: true,
              weight: true,
              isActive: true,
            },
          },
        },
      },
    },
  })

  if (!position) {
    return null
  }

  const weightedTypes = new Set([
    "PERFORMANCE_OBJECTIVE",
    "KEY_PERFORMANCE_INDICATOR",
    "TECHNICAL_COMPETENCY",
    "BEHAVIOURAL_COMPETENCY",
  ])

  return {
    position: {
      id: position.id,
      title: position.title,
      code: position.code,
      department: position.department,
    },
    versions: position.jobDescriptions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      status: version.status,
      isCurrent: version.isCurrent,
      effectiveFrom: version.effectiveFrom
        .toISOString()
        .slice(0, 10),
      effectiveUntil:
        version.effectiveUntil?.toISOString().slice(0, 10) ??
        null,
      updatedAt: version.updatedAt.toISOString(),
      criterionCount: version.criteria.length,
      totalAppraisalWeight: version.criteria
        .filter(
          (criterion) =>
            criterion.isActive &&
            weightedTypes.has(criterion.criterionType),
        )
        .reduce(
          (total, criterion) =>
            total + Number(criterion.weight.toString()),
          0,
        ),
    })),
  }
}
