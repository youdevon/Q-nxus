"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  JobCriterionType,
  JobDescriptionStatus,
  Prisma,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities"

export type JobDescriptionFormState = {
  status: "idle" | "error" | "conflict"
  message: string
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function nullableText(
  formData: FormData,
  key: string,
): string | null {
  const value = textValue(formData, key)
  return value.length > 0 ? value : null
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function getRequestMetadata() {
  const requestHeaders = await headers()

  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      null,
    userAgent: requestHeaders.get("user-agent"),
  }
}

function parseCriteria(formData: FormData) {
  const rowIds = formData
    .getAll("criterionRowIds")
    .filter((value): value is string => typeof value === "string")

  const criteria = []

  for (const rowId of rowIds) {
    const title = textValue(formData, `criterionTitle:${rowId}`)

    if (!title) {
      continue
    }

    const criterionTypeValue = textValue(
      formData,
      `criterionType:${rowId}`,
    )

    if (
      !Object.values(JobCriterionType).includes(
        criterionTypeValue as JobCriterionType,
      )
    ) {
      throw new Error("INVALID_CRITERION_TYPE")
    }

    const weightValue = Number(
      textValue(formData, `criterionWeight:${rowId}`) || "0",
    )

    if (
      !Number.isFinite(weightValue) ||
      weightValue < 0 ||
      weightValue > 100
    ) {
      throw new Error("INVALID_CRITERION_WEIGHT")
    }

    const sortOrderValue = Number(
      textValue(formData, `criterionSortOrder:${rowId}`) || "0",
    )

    criteria.push({
      criterionType:
        criterionTypeValue as JobCriterionType,
      title,
      description: nullableText(
        formData,
        `criterionDescription:${rowId}`,
      ),
      measurement: nullableText(
        formData,
        `criterionMeasurement:${rowId}`,
      ),
      weight: new Prisma.Decimal(weightValue),
      sortOrder: Number.isInteger(sortOrderValue)
        ? sortOrderValue
        : 0,
      isActive:
        formData.get(`criterionActive:${rowId}`) === "on",
    })
  }

  const weightedTypes = new Set<JobCriterionType>([
    JobCriterionType.PERFORMANCE_OBJECTIVE,
    JobCriterionType.KEY_PERFORMANCE_INDICATOR,
    JobCriterionType.TECHNICAL_COMPETENCY,
    JobCriterionType.BEHAVIOURAL_COMPETENCY,
  ])

  const totalWeight = criteria
    .filter((criterion) =>
      weightedTypes.has(criterion.criterionType),
    )
    .reduce(
      (total, criterion) =>
        total + Number(criterion.weight.toString()),
      0,
    )

  if (totalWeight > 100) {
    throw new Error("TOTAL_WEIGHT_EXCEEDS_100")
  }

  return criteria
}

export async function createJobDescription(
  _previousState: JobDescriptionFormState,
  formData: FormData,
): Promise<JobDescriptionFormState> {

  const actor = await requireActor("people.manage")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const positionId = textValue(formData, "positionId")
  const title = textValue(formData, "title")
  const effectiveFrom = parseDate(
    textValue(formData, "effectiveFrom"),
  )
  const effectiveUntil = parseDate(
    textValue(formData, "effectiveUntil"),
  )

  if (!positionId || title.length < 2 || !effectiveFrom) {
    return {
      status: "error",
      message:
        "Position, title and effective-from date are required.",
    }
  }

  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    return {
      status: "error",
      message:
        "Effective-until date cannot be before effective-from date.",
    }
  }

  try {
    const criteria = parseCriteria(formData)
    const metadata = await getRequestMetadata()
        const created = await prisma.$transaction(
      async (transaction) => {
        const position = await transaction.position.findUnique({
          where: {
            id: positionId,
          },
          select: {
            id: true,
            title: true,
          },
        })

        if (!position) {
          throw new Error("POSITION_NOT_FOUND")
        }

        const latest =
          await transaction.positionJobDescription.findFirst({
            where: {
              positionId,
            },
            orderBy: {
              versionNumber: "desc",
            },
            select: {
              versionNumber: true,
            },
          })

        const versionNumber =
          (latest?.versionNumber ?? 0) + 1

        const jobDescription =
          await transaction.positionJobDescription.create({
            data: {
              positionId,
              versionNumber,
              title,
              summary: nullableText(formData, "summary"),
              positionPurpose: nullableText(
                formData,
                "positionPurpose",
              ),
              reportsTo: nullableText(formData, "reportsTo"),
              supervisoryResponsibility: nullableText(
                formData,
                "supervisoryResponsibility",
              ),
              qualifications: nullableText(
                formData,
                "qualifications",
              ),
              requiredExperience: nullableText(
                formData,
                "requiredExperience",
              ),
              status: JobDescriptionStatus.DRAFT,
              effectiveFrom,
              effectiveUntil,
              isCurrent: false,
              criteria: {
                create: criteria,
              },
            },
          })

        await transaction.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "hr",
            action: "CREATE",
            entityType: "PositionJobDescription",
            entityId: jobDescription.id,
            description: `Created job description version ${versionNumber} for ${position.title}.`,
            newValues: {
              positionId,
              versionNumber,
              title,
              effectiveFrom,
              effectiveUntil,
              criterionCount: criteria.length,
              status: JobDescriptionStatus.DRAFT,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        })

        return jobDescription
      },
    )

    revalidatePath(
      `/people/structure/positions/${positionId}/job-descriptions/${created.id}`,
    )

    redirect(
      `/people/structure/positions/${positionId}/job-descriptions/${created.id}`,
    )
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    console.error("Unable to create job description:", error)

    const message =
      error instanceof Error &&
      error.message === "TOTAL_WEIGHT_EXCEEDS_100"
        ? "The total appraisal weighting cannot exceed 100%."
        : error instanceof Error &&
            error.message === "INVALID_CRITERION_WEIGHT"
          ? "Each criterion weight must be between 0 and 100."
          : "The job description could not be created."

    return {
      status: "error",
      message,
    }
  }
}

export async function updateJobDescription(
  _previousState: JobDescriptionFormState,
  formData: FormData,
): Promise<JobDescriptionFormState> {

  const actor = await requireActor("people.manage")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const id = textValue(formData, "id")
  const positionId = textValue(formData, "positionId")
  const submittedUpdatedAt = textValue(formData, "updatedAt")
  const title = textValue(formData, "title")
  const effectiveFrom = parseDate(
    textValue(formData, "effectiveFrom"),
  )
  const effectiveUntil = parseDate(
    textValue(formData, "effectiveUntil"),
  )

  if (
    !id ||
    !positionId ||
    !submittedUpdatedAt ||
    title.length < 2 ||
    !effectiveFrom
  ) {
    return {
      status: "error",
      message: "The job-description information is incomplete.",
    }
  }

  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    return {
      status: "error",
      message:
        "Effective-until date cannot be before effective-from date.",
    }
  }

  try {
    const criteria = parseCriteria(formData)

    const current =
      await prisma.positionJobDescription.findUnique({
        where: {
          id,
        },
        include: {
          criteria: true,
        },
      })

    if (!current || current.positionId !== positionId) {
      return {
        status: "error",
        message: "The job description no longer exists.",
      }
    }

    if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "This job description changed elsewhere. Refresh before saving.",
      }
    }

    const metadata = await getRequestMetadata()
        const saved = await prisma.$transaction(
      async (transaction) => {
        const updatedCount =
          await transaction.positionJobDescription.updateMany({
            where: {
              id,
              updatedAt: current.updatedAt,
            },
            data: {
              title,
              summary: nullableText(formData, "summary"),
              positionPurpose: nullableText(
                formData,
                "positionPurpose",
              ),
              reportsTo: nullableText(formData, "reportsTo"),
              supervisoryResponsibility: nullableText(
                formData,
                "supervisoryResponsibility",
              ),
              qualifications: nullableText(
                formData,
                "qualifications",
              ),
              requiredExperience: nullableText(
                formData,
                "requiredExperience",
              ),
              effectiveFrom,
              effectiveUntil,
            },
          })

        if (updatedCount.count !== 1) {
          return false
        }

        await transaction.jobDescriptionCriterion.deleteMany({
          where: {
            jobDescriptionId: id,
          },
        })

        if (criteria.length > 0) {
          await transaction.jobDescriptionCriterion.createMany({
            data: criteria.map((criterion) => ({
              jobDescriptionId: id,
              ...criterion,
            })),
          })
        }

        const updated =
          await transaction.positionJobDescription.findUniqueOrThrow({
            where: {
              id,
            },
          })

        await transaction.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "hr",
            action: "UPDATE",
            entityType: "PositionJobDescription",
            entityId: id,
            description: `Updated job description version ${updated.versionNumber}.`,
            oldValues: {
              title: current.title,
              summary: current.summary,
              positionPurpose: current.positionPurpose,
              reportsTo: current.reportsTo,
              supervisoryResponsibility:
                current.supervisoryResponsibility,
              qualifications: current.qualifications,
              requiredExperience: current.requiredExperience,
              effectiveFrom: current.effectiveFrom,
              effectiveUntil: current.effectiveUntil,
              criterionCount: current.criteria.length,
            },
            newValues: {
              title: updated.title,
              summary: updated.summary,
              positionPurpose: updated.positionPurpose,
              reportsTo: updated.reportsTo,
              supervisoryResponsibility:
                updated.supervisoryResponsibility,
              qualifications: updated.qualifications,
              requiredExperience: updated.requiredExperience,
              effectiveFrom: updated.effectiveFrom,
              effectiveUntil: updated.effectiveUntil,
              criterionCount: criteria.length,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        })

        return true
      },
    )

    if (!saved) {
      return {
        status: "conflict",
        message:
          "This job description changed during saving. Refresh the page.",
      }
    }

    revalidatePath(
      `/people/structure/positions/${positionId}/job-descriptions/${id}`,
    )

    redirect(
      `/people/structure/positions/${positionId}/job-descriptions/${id}`,
    )
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    console.error("Unable to update job description:", error)

    return {
      status: "error",
      message:
        error instanceof Error &&
        error.message === "TOTAL_WEIGHT_EXCEEDS_100"
          ? "The total appraisal weighting cannot exceed 100%."
          : "The job description could not be updated.",
    }
  }
}

export async function activateJobDescription(
  formData: FormData,
): Promise<void> {

  const actor = await requireActor("people.manage")
  if (!actor.ok) {
    throw new Error(actor.message)
  }

  const id = textValue(formData, "id")
  const positionId = textValue(formData, "positionId")

  if (!id || !positionId) {
    return
  }

  const metadata = await getRequestMetadata()
    await prisma.$transaction(async (transaction) => {
    const current =
      await transaction.positionJobDescription.findUnique({
        where: {
          id,
        },
      })

    if (!current || current.positionId !== positionId) {
      return
    }

    await transaction.positionJobDescription.updateMany({
      where: {
        positionId,
        id: {
          not: id,
        },
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        status: JobDescriptionStatus.RETIRED,
      },
    })

    await transaction.positionJobDescription.update({
      where: {
        id,
      },
      data: {
        isCurrent: true,
        status: JobDescriptionStatus.ACTIVE,
      },
    })

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "ACTIVATE",
        entityType: "PositionJobDescription",
        entityId: id,
        description: `Activated job description version ${current.versionNumber}.`,
        oldValues: {
          status: current.status,
          isCurrent: current.isCurrent,
        },
        newValues: {
          status: JobDescriptionStatus.ACTIVE,
          isCurrent: true,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    })
  })

  revalidatePath(
    `/people/structure/positions/${positionId}/job-descriptions/${id}`,
  )
}

export async function cloneJobDescription(
  formData: FormData,
): Promise<void> {

  const actor = await requireActor("people.manage")
  if (!actor.ok) {
    throw new Error(actor.message)
  }

  const id = textValue(formData, "id")
  const positionId = textValue(formData, "positionId")

  if (!id || !positionId) {
    return
  }

  const metadata = await getRequestMetadata()
    const cloned = await prisma.$transaction(
    async (transaction) => {
      const source =
        await transaction.positionJobDescription.findFirst({
          where: {
            id,
            positionId,
          },
          include: {
            position: {
              select: {
                title: true,
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
            },
          },
        })

      if (!source) {
        return null
      }

      const latest =
        await transaction.positionJobDescription.findFirst({
          where: {
            positionId,
          },
          orderBy: {
            versionNumber: "desc",
          },
          select: {
            versionNumber: true,
          },
        })

      const versionNumber =
        (latest?.versionNumber ?? 0) + 1

      const created =
        await transaction.positionJobDescription.create({
          data: {
            positionId,
            versionNumber,
            title: source.title,
            summary: source.summary,
            positionPurpose: source.positionPurpose,
            reportsTo: source.reportsTo,
            supervisoryResponsibility:
              source.supervisoryResponsibility,
            qualifications: source.qualifications,
            requiredExperience: source.requiredExperience,
            status: JobDescriptionStatus.DRAFT,
            effectiveFrom: new Date(),
            effectiveUntil: null,
            isCurrent: false,
            criteria: {
              create: source.criteria.map((criterion) => ({
                criterionType: criterion.criterionType,
                title: criterion.title,
                description: criterion.description,
                measurement: criterion.measurement,
                weight: criterion.weight,
                sortOrder: criterion.sortOrder,
                isActive: criterion.isActive,
              })),
            },
          },
        })

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CLONE",
          entityType: "PositionJobDescription",
          entityId: created.id,
          description: `Created job description version ${versionNumber} from version ${source.versionNumber} for ${source.position.title}.`,
          oldValues: {
            sourceId: source.id,
            sourceVersion: source.versionNumber,
          },
          newValues: {
            id: created.id,
            versionNumber,
            status: JobDescriptionStatus.DRAFT,
            criterionCount: source.criteria.length,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })

      return created
    },
  )

  if (!cloned) {
    return
  }

  revalidatePath(
    `/people/structure/positions/${positionId}/job-descriptions`,
  )

  redirect(
    `/people/structure/positions/${positionId}/job-descriptions/${cloned.id}`,
  )
}

export async function retireJobDescription(
  formData: FormData,
): Promise<void> {

  const actor = await requireActor("people.manage")
  if (!actor.ok) {
    throw new Error(actor.message)
  }

  const id = textValue(formData, "id")
  const positionId = textValue(formData, "positionId")

  if (!id || !positionId) {
    return
  }

  const metadata = await getRequestMetadata()
    await prisma.$transaction(async (transaction) => {
    const current =
      await transaction.positionJobDescription.findFirst({
        where: {
          id,
          positionId,
        },
      })

    if (!current) {
      return
    }

    const updated =
      await transaction.positionJobDescription.update({
        where: {
          id,
        },
        data: {
          status: JobDescriptionStatus.RETIRED,
          isCurrent: false,
          effectiveUntil:
            current.effectiveUntil ?? new Date(),
        },
      })

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "RETIRE",
        entityType: "PositionJobDescription",
        entityId: id,
        description: `Retired job description version ${updated.versionNumber}.`,
        oldValues: {
          status: current.status,
          isCurrent: current.isCurrent,
          effectiveUntil: current.effectiveUntil,
        },
        newValues: {
          status: updated.status,
          isCurrent: updated.isCurrent,
          effectiveUntil: updated.effectiveUntil,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    })
  })

  revalidatePath(
    `/people/structure/positions/${positionId}/job-descriptions`,
  )
}
