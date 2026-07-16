"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  LeaveBalanceTransactionType,
  LeaveRequestStatus,
  NotificationSeverity,
  Prisma,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCurrentEmployeeUser } from "@/src/modules/auth/data/get-current-user"
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities"
import { resolveEmployeeSupervisor, describeSupervisorResolutionIssue } from "@/src/modules/hr/data/resolve-employee-supervisor"
import { validateContractLeaveRequest } from "@/src/modules/hr/services/validate-contract-leave-request"
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification"

export type LeaveRequestFormState = {
  status: "idle" | "error"
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

function buildRequestNumber(sequence: number): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")

  return `LR-${stamp}-${String(sequence).padStart(4, "0")}`
}

export async function createLeaveRequest(
  _previousState: LeaveRequestFormState,
  formData: FormData,
): Promise<LeaveRequestFormState> {
  const actor = await requireActor("leave.request")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const leaveTypeId = textValue(formData, "leaveTypeId")
  const contractId = textValue(formData, "contractId")
  const startDate = parseDate(textValue(formData, "startDate"))
  const endDate = parseDate(textValue(formData, "endDate"))
  const reason = nullableText(formData, "reason")
  const employeeComment = nullableText(
    formData,
    "employeeComment",
  )

  const fieldErrors: Record<string, string> = {}

  if (!leaveTypeId) {
    fieldErrors.leaveTypeId = "Select a leave type."
  }

  if (!contractId) {
    fieldErrors.contractId =
      "Select the employment contract for this request."
  }

  if (!startDate) {
    fieldErrors.startDate = "Enter the leave start date."
  }

  if (!endDate) {
    fieldErrors.endDate = "Enter the leave end date."
  }

  if (startDate && endDate && endDate < startDate) {
    fieldErrors.endDate =
      "The end date cannot be before the start date."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the leave request details.",
      fieldErrors,
    }
  }

  let user

  try {
    user = await requireCurrentEmployeeUser()
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active employee-linked user is required.",
    }
  }

  let validated

  try {
    validated = await validateContractLeaveRequest({
      employeeId: user.employeeId,
      contractId,
      leaveTypeId,
      startDate: startDate!,
      endDate: endDate!,
    })
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be validated.",
    }
  }

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      status: {
        in: [
          LeaveRequestStatus.SUBMITTED,
          LeaveRequestStatus.PENDING_APPROVAL,
          LeaveRequestStatus.APPROVED,
        ],
      },
      startDate: {
        lte: endDate!,
      },
      endDate: {
        gte: startDate!,
      },
    },
    select: {
      id: true,
      requestNumber: true,
    },
  })

  if (overlapping) {
    return {
      status: "error",
      message: overlapping.requestNumber
        ? `These dates overlap an existing leave request (${overlapping.requestNumber}).`
        : "These dates overlap an existing leave request.",
    }
  }

  const supervisor = await resolveEmployeeSupervisor(
    user.employeeId,
  )

  if (!supervisor?.supervisorUserId) {
    return {
      status: "error",
      message: describeSupervisorResolutionIssue(supervisor),
    }
  }

  const metadata = await requestMetadata()

  try {
    const leaveRequest = await prisma.$transaction(
      async (transaction) => {
        const sequence =
          (await transaction.leaveRequest.count({
            where: {
              organizationId: user.employee.organizationId,
            },
          })) + 1

        const requestNumber = buildRequestNumber(sequence)

        const created = await transaction.leaveRequest.create({
          data: {
            organizationId: user.employee.organizationId,
            employeeId: user.employeeId,
            contractId: validated.contractId,
            leaveTypeId: validated.leaveTypeId,
            leaveBalanceId: validated.leaveBalanceId,
            requestNumber,
            startDate: startDate!,
            endDate: endDate!,
            requestedQuantity: validated.requestedQuantity,
            reason,
            employeeComment,
            status: LeaveRequestStatus.PENDING_APPROVAL,
            submittedAt: new Date(),
            createdByUserId: user.id,
            days: {
              create: validated.days.map((day) => ({
                leaveDate: day.leaveDate,
                quantity: day.quantity,
                isWorkingDay: day.isWorkingDay,
              })),
            },
            approvalSteps: {
              create: {
                stepNumber: 1,
                approverUserId: supervisor.supervisorUserId,
                approverPositionId:
                  supervisor.supervisorPositionId,
                status: "PENDING",
              },
            },
          },
          include: {
            leaveType: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        })

        if (validated.leaveBalanceId) {
          const balance =
            await transaction.employeeLeaveBalance.findUnique({
              where: {
                id: validated.leaveBalanceId,
              },
              select: {
                id: true,
                reserved: true,
                availableBalance: true,
              },
            })

          if (!balance) {
            throw new Error(
              "The leave balance for this request no longer exists.",
            )
          }

          const balanceBefore = balance.availableBalance
          const balanceAfter = balanceBefore.minus(
            validated.requestedQuantity,
          )

          await transaction.employeeLeaveBalance.update({
            where: {
              id: balance.id,
            },
            data: {
              reserved: balance.reserved.plus(
                validated.requestedQuantity,
              ),
              availableBalance: balanceAfter,
              lastCalculatedAt: new Date(),
            },
          })

          await transaction.leaveBalanceTransaction.create({
            data: {
              employeeId: user.employeeId,
              contractId: validated.contractId,
              leaveTypeId: validated.leaveTypeId,
              leaveBalanceId: balance.id,
              transactionType:
                LeaveBalanceTransactionType.REQUEST_RESERVED,
              quantity: validated.requestedQuantity,
              balanceBefore,
              balanceAfter,
              effectiveDate: startDate!,
              referenceType: "LeaveRequest",
              referenceId: created.id,
              description: `Reserved leave for request ${requestNumber}.`,
              createdByUserId: user.id,
            },
          })
        }

        await transaction.auditEvent.create({
          data: {
            userId: user.id,
            moduleKey: "hr",
            action: "CREATE",
            entityType: "LeaveRequest",
            entityId: created.id,
            description: `Submitted leave request ${requestNumber} for ${user.employee.employeeNumber}.`,
            newValues: {
              requestNumber,
              leaveTypeId: validated.leaveTypeId,
              contractId: validated.contractId,
              startDate: startDate!.toISOString(),
              endDate: endDate!.toISOString(),
              requestedQuantity:
                validated.requestedQuantity.toString(),
              status: LeaveRequestStatus.PENDING_APPROVAL,
              approverUserId: supervisor.supervisorUserId,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        })

        return created
      },
    )

    if (supervisor.supervisorUserId) {
      const quantityLabel =
        leaveRequest.requestedQuantity.toString()

      try {
        await createSystemNotification({
          title: "Leave approval required",
          message: `${user.employee.firstName} ${user.employee.lastName} requested ${quantityLabel} day(s) of ${leaveRequest.leaveType.name} from ${startDate!.toISOString().slice(0, 10)} to ${endDate!.toISOString().slice(0, 10)}.`,
          severity: NotificationSeverity.INFORMATION,
          moduleKey: "hr",
          actionUrl: `/leave/${leaveRequest.id}`,
          relatedType: "LeaveRequest",
          relatedId: leaveRequest.id,
          recipients: [
            {
              userId: supervisor.supervisorUserId,
              email: supervisor.supervisorUserEmail,
              name: supervisor.supervisorUserName,
              sendEmail: Boolean(
                supervisor.supervisorUserEmail,
              ),
            },
          ],
          email: {
            subject: `Leave approval required · ${leaveRequest.requestNumber}`,
            actionLabel: "Review leave request",
          },
        })
      } catch (notificationError) {
        console.error(
          "Leave request created but supervisor notification failed:",
          notificationError,
        )
      }
    }

    revalidatePath("/leave")
    revalidatePath("/people/leave/balances")
    revalidatePath(`/leave/${leaveRequest.id}`)

    redirect(`/leave/${leaveRequest.id}`)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message:
          "A leave request with this reference already exists. Try again.",
      }
    }

    console.error("Unable to create leave request:", error)

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be submitted.",
    }
  }
}
