"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { EmployeeAssignmentType } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities"
import { syncEmployeeAccessRoles } from "@/src/modules/auth/services/provision-employee-user"

export type EmployeeAssignmentFormState = {
  status: "idle" | "error" | "conflict"
  message: string
  fieldErrors?: Record<string, string>
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

async function requestMetadata() {
  const requestHeaders = await headers()

  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      null,
    userAgent: requestHeaders.get("user-agent"),
  }
}

export async function createEmployeeAssignment(
  _previousState: EmployeeAssignmentFormState,
  formData: FormData,
): Promise<EmployeeAssignmentFormState> {
  const actor = await requireActor("people.manage")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const employeeId = textValue(formData, "employeeId")
  const submittedUpdatedAt = textValue(
    formData,
    "employeeUpdatedAt",
  )
  const departmentId = textValue(formData, "departmentId")
  const positionId = nullableText(formData, "positionId")
  const assignmentTypeValue = textValue(
    formData,
    "assignmentType",
  )
  const startDate = parseDate(textValue(formData, "startDate"))
  const referenceNumber = nullableText(
    formData,
    "referenceNumber",
  )
  const reason = nullableText(formData, "reason")
  const notes = nullableText(formData, "notes")
  const isActing = formData.get("isActing") === "on"
  const returnTo = nullableText(formData, "returnTo")

  const fieldErrors: Record<string, string> = {}

  if (!employeeId) {
    fieldErrors.employeeId = "Select an employee."
  }

  if (!departmentId) {
    fieldErrors.departmentId = "Select a department."
  }

  if (!startDate) {
    fieldErrors.startDate = "Enter a valid start date."
  }

  if (
    !Object.values(EmployeeAssignmentType).includes(
      assignmentTypeValue as EmployeeAssignmentType,
    )
  ) {
    fieldErrors.assignmentType =
      "Select a valid assignment type."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the assignment information.",
      fieldErrors,
    }
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      updatedAt: true,
    },
  })

  if (!employee) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    }
  }

  if (
    !submittedUpdatedAt ||
    employee.updatedAt.toISOString() !== submittedUpdatedAt
  ) {
    return {
      status: "conflict",
      message:
        "The employee record changed elsewhere. Refresh before continuing.",
    }
  }

  if (startDate! < employee.hireDate) {
    return {
      status: "error",
      message:
        "The assignment start date cannot be before the employee’s hire date.",
    }
  }

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      organizationId: employee.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!department) {
    return {
      status: "error",
      message: "The selected department is invalid or inactive.",
    }
  }

  let position:
    | {
        id: string
        title: string
      }
    | null = null

  if (positionId) {
    position = await prisma.position.findFirst({
      where: {
        id: positionId,
        departmentId,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
      },
    })

    if (!position) {
      return {
        status: "error",
        message:
          "The selected position does not belong to the department.",
      }
    }
  }

  const metadata = await requestMetadata()

  try {
    await prisma.$transaction(async (transaction) => {
      const currentAssignment =
        await transaction.employeeAssignment.findFirst({
          where: {
            employeeId,
            isCurrent: true,
          },
          orderBy: {
            startDate: "desc",
          },
        })

      if (
        currentAssignment &&
        startDate! <= currentAssignment.startDate
      ) {
        throw new Error(
          "The new assignment must begin after the current assignment started.",
        )
      }

      if (currentAssignment) {
        const previousEndDate = new Date(startDate!)
        previousEndDate.setUTCDate(
          previousEndDate.getUTCDate() - 1,
        )

        await transaction.employeeAssignment.update({
          where: {
            id: currentAssignment.id,
          },
          data: {
            isCurrent: false,
            endDate: previousEndDate,
          },
        })
      }

      let jobDescriptionId: string | null = null

      if (positionId) {
        const currentJobDescription =
          await transaction.positionJobDescription.findFirst({
            where: {
              positionId,
              isCurrent: true,
              status: "ACTIVE",
              effectiveFrom: {
                lte: startDate!,
              },
              OR: [
                {
                  effectiveUntil: null,
                },
                {
                  effectiveUntil: {
                    gte: startDate!,
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
          })

        jobDescriptionId = currentJobDescription?.id ?? null
      }

      const assignment =
        await transaction.employeeAssignment.create({
          data: {
            employeeId,
            departmentId,
            positionId,
            jobDescriptionId,
            assignmentType:
              assignmentTypeValue as EmployeeAssignmentType,
            startDate: startDate!,
            isCurrent: true,
            isActing,
            referenceNumber,
            reason,
            notes,
          },
        })

      await transaction.employee.update({
        where: {
          id: employeeId,
        },
        data: {
          departmentId,
          positionId,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "ASSIGN",
          entityType: "EmployeeAssignment",
          entityId: assignment.id,
          description: `Assigned ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName} to ${position?.title ?? department.name}.`,
          newValues: {
            employeeId,
            departmentId,
            positionId,
            jobDescriptionId,
            assignmentType: assignment.assignmentType,
            startDate: assignment.startDate,
            isActing: assignment.isActing,
            referenceNumber: assignment.referenceNumber,
            reason: assignment.reason,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    const linkedUser = await prisma.user.findFirst({
      where: {
        employeeId,
      },
      select: {
        id: true,
      },
    })

    if (linkedUser) {
      await syncEmployeeAccessRoles(linkedUser.id, employeeId)
    }

    revalidatePath("/people")
    revalidatePath(`/people/employees/${employeeId}`)
    revalidatePath(
      `/people/employees/${employeeId}/assignments`,
    )

    if (positionId) {
      revalidatePath(
        `/people/structure/positions/${positionId}`,
      )
      revalidatePath("/people/structure")
      revalidatePath("/people/structure/chart")
    }

    if (departmentId) {
      revalidatePath(
        `/people/structure/departments/${departmentId}`,
      )
    }

    const safeReturnTo =
      returnTo &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//")
        ? returnTo
        : null

    redirect(
      safeReturnTo ??
        `/people/employees/${employeeId}/assignments`,
    )
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    console.error(
      "Unable to create employee assignment:",
      error,
    )

    return {
      status: "error",
      message:
        error instanceof Error &&
        error.message.includes(
          "must begin after the current assignment",
        )
          ? error.message
          : "The employee assignment could not be created.",
    }
  }
}
