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
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification"

export type LeaveDecisionFormState = {
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

export async function decideLeaveRequest(
  _previousState: LeaveDecisionFormState,
  formData: FormData,
): Promise<LeaveDecisionFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId")
  const decision = textValue(formData, "decision")
  const decisionComment = nullableText(
    formData,
    "decisionComment",
  )

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    }
  }

  if (decision !== "APPROVE" && decision !== "REJECT") {
    return {
      status: "error",
      message: "Choose approve or reject.",
    }
  }

  if (decision === "REJECT" && !decisionComment) {
    return {
      status: "error",
      message: "A comment is required when rejecting leave.",
    }
  }

  let user

  try {
    user = await requireCurrentUser()
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active user account is required.",
    }
  }

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
      approvalSteps: {
        where: {
          status: LeaveApprovalStatus.PENDING,
        },
        orderBy: {
          stepNumber: "asc",
        },
      },
    },
  })

  if (!request) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    }
  }

  if (
    request.status !== LeaveRequestStatus.SUBMITTED &&
    request.status !== LeaveRequestStatus.PENDING_APPROVAL
  ) {
    return {
      status: "error",
      message: "This leave request is no longer awaiting a decision.",
    }
  }

  const pendingStep =
    request.approvalSteps.find(
      (step) => step.approverUserId === user.id,
    ) ?? null

  const capabilities = await getUserCapabilities(user.id)
  const canOverride =
    capabilities?.canAny("leave.approve", "leave.manage") ??
    false

  const stepToDecide =
    pendingStep ??
    (canOverride ? request.approvalSteps[0] ?? null : null)

  if (!stepToDecide) {
    return {
      status: "error",
      message:
        "You are not the assigned approver for this leave request.",
    }
  }

  const metadata = await requestMetadata()
  const approved = decision === "APPROVE"
  const now = new Date()

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.leaveApprovalStep.update({
        where: {
          id: stepToDecide.id,
        },
        data: {
          status: approved
            ? LeaveApprovalStatus.APPROVED
            : LeaveApprovalStatus.REJECTED,
          decidedAt: now,
          decisionComment,
          ...(pendingStep
            ? {}
            : {
                approverUserId: user.id,
              }),
        },
      })

      await transaction.leaveRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: approved
            ? LeaveRequestStatus.APPROVED
            : LeaveRequestStatus.REJECTED,
          approvedAt: approved ? now : null,
          rejectedAt: approved ? null : now,
          finalDecisionByUserId: user.id,
          finalDecisionComment: decisionComment,
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
              taken: true,
              availableBalance: true,
            },
          })

        if (!balance) {
          throw new Error(
            "The leave balance for this request no longer exists.",
          )
        }

        if (approved) {
          const balanceBefore = balance.availableBalance

          await transaction.employeeLeaveBalance.update({
            where: {
              id: balance.id,
            },
            data: {
              reserved: balance.reserved.minus(
                request.requestedQuantity,
              ),
              taken: balance.taken.plus(
                request.requestedQuantity,
              ),
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
                LeaveBalanceTransactionType.LEAVE_TAKEN,
              quantity: request.requestedQuantity,
              balanceBefore,
              balanceAfter: balanceBefore,
              effectiveDate: request.startDate,
              referenceType: "LeaveRequest",
              referenceId: request.id,
              description: `Leave taken for approved request ${request.requestNumber ?? request.id}.`,
              createdByUserId: user.id,
            },
          })
        } else {
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
              description: `Released reserved leave for rejected request ${request.requestNumber ?? request.id}.`,
              createdByUserId: user.id,
            },
          })
        }
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: approved ? "APPROVE" : "REJECT",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `${approved ? "Approved" : "Rejected"} leave request ${request.requestNumber ?? request.id} for ${request.employee.employeeNumber}.`,
          newValues: {
            decision,
            decisionComment,
            status: approved
              ? LeaveRequestStatus.APPROVED
              : LeaveRequestStatus.REJECTED,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    const employeeUser = request.employee.user

    if (employeeUser?.isActive) {
      try {
        await createSystemNotification({
          title: approved
            ? "Leave request approved"
            : "Leave request rejected",
          message: approved
            ? `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved.`
            : `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was rejected${decisionComment ? `: ${decisionComment}` : "."}`,
          severity: approved
            ? NotificationSeverity.SUCCESS
            : NotificationSeverity.WARNING,
          moduleKey: "hr",
          actionUrl: `/leave/${request.id}`,
          relatedType: "LeaveRequest",
          relatedId: request.id,
          recipients: [
            {
              userId: employeeUser.id,
              email: employeeUser.email,
              name: `${employeeUser.firstName} ${employeeUser.lastName}`,
              sendEmail: Boolean(employeeUser.email),
            },
          ],
          email: {
            subject: `${approved ? "Approved" : "Rejected"} · ${request.requestNumber ?? "Leave request"}`,
            actionLabel: "View leave request",
          },
        })
      } catch (notificationError) {
        console.error(
          "Leave decision saved but employee notification failed:",
          notificationError,
        )
      }
    }

    revalidatePath("/leave")
    revalidatePath(`/leave/${request.id}`)
    revalidatePath("/people/leave/balances")
    revalidatePath("/notifications")

    return {
      status: "success",
      message: approved
        ? "Leave request approved."
        : "Leave request rejected.",
    }
  } catch (error) {
    console.error("Unable to decide leave request:", error)

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave decision could not be saved.",
    }
  }
}
