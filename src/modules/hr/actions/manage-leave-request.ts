"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import {
  LeaveApprovalStatus,
  LeaveBalanceTransactionType,
  LeaveRequestStatus,
  NotificationSeverity,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCurrentEmployeeUser } from "@/src/modules/auth/data/get-current-user"
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification"

export type LeaveLifecycleFormState = {
  status: "idle" | "error" | "success"
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

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  )
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

async function loadOwnedLeaveRequest(leaveRequestId: string) {
  const user = await requireCurrentEmployeeUser()

  const request = await prisma.leaveRequest.findUnique({
    where: {
      id: leaveRequestId,
    },
    include: {
      leaveType: {
        select: {
          name: true,
          code: true,
        },
      },
      approvalSteps: {
        orderBy: {
          stepNumber: "asc",
        },
        include: {
          approverUser: {
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
  })

  if (!request) {
    return {
      ok: false as const,
      error: "The leave request could not be found.",
    }
  }

  if (request.employeeId !== user.employeeId) {
    return {
      ok: false as const,
      error:
        "Only the employee who owns this request can change it.",
    }
  }

  return {
    ok: true as const,
    user,
    request,
  }
}

async function notifyApprovers({
  requestId,
  requestNumber,
  leaveTypeName,
  title,
  message,
  severity,
  recipients,
}: {
  requestId: string
  requestNumber: string | null
  leaveTypeName: string
  title: string
  message: string
  severity: NotificationSeverity
  recipients: {
    id: string
    email: string
    firstName: string
    lastName: string
    isActive: boolean
  }[]
}) {
  const uniqueRecipients = [
    ...new Map(
      recipients
        .filter((recipient) => recipient.isActive)
        .map((recipient) => [recipient.id, recipient]),
    ).values(),
  ]

  if (uniqueRecipients.length === 0) {
    return
  }

  await createSystemNotification({
    title,
    message,
    severity,
    moduleKey: "hr",
    actionUrl: `/leave/${requestId}`,
    relatedType: "LeaveRequest",
    relatedId: requestId,
    recipients: uniqueRecipients.map((recipient) => ({
      userId: recipient.id,
      email: recipient.email,
      name: `${recipient.firstName} ${recipient.lastName}`,
      sendEmail: Boolean(recipient.email),
    })),
    email: {
      subject: `${title} · ${requestNumber ?? leaveTypeName}`,
      actionLabel: "View leave request",
    },
  })
}

export async function withdrawLeaveRequest(
  _previousState: LeaveLifecycleFormState,
  formData: FormData,
): Promise<LeaveLifecycleFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId")
  const comment = nullableText(formData, "comment")

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    }
  }

  let loaded

  try {
    loaded = await loadOwnedLeaveRequest(leaveRequestId)
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active employee-linked user is required.",
    }
  }

  if (!loaded.ok) {
    return {
      status: "error",
      message: loaded.error,
    }
  }

  const { user, request } = loaded

  if (
    request.status !== LeaveRequestStatus.SUBMITTED &&
    request.status !== LeaveRequestStatus.PENDING_APPROVAL
  ) {
    return {
      status: "error",
      message:
        "Only pending leave requests can be withdrawn.",
    }
  }

  const metadata = await requestMetadata()
  const now = new Date()

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.leaveRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: LeaveRequestStatus.WITHDRAWN,
          withdrawnAt: now,
          finalDecisionComment: comment,
        },
      })

      await transaction.leaveApprovalStep.updateMany({
        where: {
          leaveRequestId: request.id,
          status: LeaveApprovalStatus.PENDING,
        },
        data: {
          status: LeaveApprovalStatus.CANCELLED,
          decidedAt: now,
          decisionComment:
            comment ?? "Request withdrawn by employee.",
        },
      })

      if (request.leaveBalanceId) {
        const balance =
          await transaction.employeeLeaveBalance.findUnique({
            where: {
              id: request.leaveBalanceId,
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
        const balanceAfter = balanceBefore.plus(
          request.requestedQuantity,
        )

        await transaction.employeeLeaveBalance.update({
          where: {
            id: balance.id,
          },
          data: {
            reserved: balance.reserved.minus(
              request.requestedQuantity,
            ),
            availableBalance: balanceAfter,
            lastCalculatedAt: now,
          },
        })

        await transaction.leaveBalanceTransaction.create({
          data: {
            employeeId: request.employeeId,
            contractId: request.contractId,
            leaveTypeId: request.leaveTypeId,
            leaveBalanceId: balance.id,
            transactionType:
              LeaveBalanceTransactionType.REQUEST_RELEASED,
            quantity: request.requestedQuantity,
            balanceBefore,
            balanceAfter,
            effectiveDate: now,
            referenceType: "LeaveRequest",
            referenceId: request.id,
            description: `Released reserved leave for withdrawn request ${request.requestNumber ?? request.id}.`,
            createdByUserId: user.id,
          },
        })
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: "WITHDRAW",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `Withdrew leave request ${request.requestNumber ?? request.id}.`,
          newValues: {
            status: LeaveRequestStatus.WITHDRAWN,
            comment,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    try {
      await notifyApprovers({
        requestId: request.id,
        requestNumber: request.requestNumber,
        leaveTypeName: request.leaveType.name,
        title: "Leave request withdrawn",
        message: `${user.employee.firstName} ${user.employee.lastName} withdrew their ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}).`,
        severity: NotificationSeverity.INFORMATION,
        recipients: request.approvalSteps
          .map((step) => step.approverUser)
          .filter(
            (
              approver,
            ): approver is NonNullable<typeof approver> =>
              Boolean(approver),
          ),
      })
    } catch (notificationError) {
      console.error(
        "Leave request withdrawn but approver notification failed:",
        notificationError,
      )
    }

    revalidatePath("/leave")
    revalidatePath(`/leave/${request.id}`)
    revalidatePath("/people/leave/balances")
    revalidatePath("/notifications")

    return {
      status: "success",
      message: "Leave request withdrawn.",
    }
  } catch (error) {
    console.error("Unable to withdraw leave request:", error)

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be withdrawn.",
    }
  }
}

export async function cancelLeaveRequest(
  _previousState: LeaveLifecycleFormState,
  formData: FormData,
): Promise<LeaveLifecycleFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId")
  const comment = nullableText(formData, "comment")

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    }
  }

  if (!comment) {
    return {
      status: "error",
      message: "A comment is required when cancelling approved leave.",
    }
  }

  let loaded

  try {
    loaded = await loadOwnedLeaveRequest(leaveRequestId)
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active employee-linked user is required.",
    }
  }

  if (!loaded.ok) {
    return {
      status: "error",
      message: loaded.error,
    }
  }

  const { user, request } = loaded

  if (request.status !== LeaveRequestStatus.APPROVED) {
    return {
      status: "error",
      message: "Only approved leave requests can be cancelled.",
    }
  }

  const today = startOfUtcDay(new Date())
  const leaveStart = startOfUtcDay(request.startDate)

  if (leaveStart <= today) {
    return {
      status: "error",
      message:
        "Approved leave that has already started cannot be cancelled from this screen.",
    }
  }

  const metadata = await requestMetadata()
  const now = new Date()

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.leaveRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          cancelledAt: now,
          finalDecisionComment: comment,
        },
      })

      if (request.leaveBalanceId) {
        const balance =
          await transaction.employeeLeaveBalance.findUnique({
            where: {
              id: request.leaveBalanceId,
            },
            select: {
              id: true,
              taken: true,
              availableBalance: true,
            },
          })

        if (!balance) {
          throw new Error(
            "The leave balance for this request no longer exists.",
          )
        }

        const balanceBefore = balance.availableBalance
        const balanceAfter = balanceBefore.plus(
          request.requestedQuantity,
        )

        await transaction.employeeLeaveBalance.update({
          where: {
            id: balance.id,
          },
          data: {
            taken: balance.taken.minus(
              request.requestedQuantity,
            ),
            availableBalance: balanceAfter,
            lastCalculatedAt: now,
          },
        })

        await transaction.leaveBalanceTransaction.create({
          data: {
            employeeId: request.employeeId,
            contractId: request.contractId,
            leaveTypeId: request.leaveTypeId,
            leaveBalanceId: balance.id,
            transactionType:
              LeaveBalanceTransactionType.REVERSAL,
            quantity: request.requestedQuantity,
            balanceBefore,
            balanceAfter,
            effectiveDate: now,
            referenceType: "LeaveRequest",
            referenceId: request.id,
            description: `Reversed taken leave for cancelled request ${request.requestNumber ?? request.id}.`,
            createdByUserId: user.id,
          },
        })
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: "CANCEL",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `Cancelled approved leave request ${request.requestNumber ?? request.id}.`,
          newValues: {
            status: LeaveRequestStatus.CANCELLED,
            comment,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    try {
      await notifyApprovers({
        requestId: request.id,
        requestNumber: request.requestNumber,
        leaveTypeName: request.leaveType.name,
        title: "Approved leave cancelled",
        message: `${user.employee.firstName} ${user.employee.lastName} cancelled their approved ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}): ${comment}`,
        severity: NotificationSeverity.WARNING,
        recipients: request.approvalSteps
          .map((step) => step.approverUser)
          .filter(
            (
              approver,
            ): approver is NonNullable<typeof approver> =>
              Boolean(approver),
          ),
      })
    } catch (notificationError) {
      console.error(
        "Leave request cancelled but approver notification failed:",
        notificationError,
      )
    }

    revalidatePath("/leave")
    revalidatePath(`/leave/${request.id}`)
    revalidatePath("/people/leave/balances")
    revalidatePath("/notifications")

    return {
      status: "success",
      message: "Approved leave cancelled.",
    }
  } catch (error) {
    console.error("Unable to cancel leave request:", error)

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be cancelled.",
    }
  }
}
