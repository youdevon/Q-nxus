"use server";

import { revalidatePath } from "next/cache";

import {
  LeaveApprovalStatus,
  LeaveBalanceTransactionType,
  LeaveRequestStatus,
  NotificationSeverity,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { findUsersWithPermission } from "@/src/modules/hr/data/find-users-with-permission";
import { getLeaveWorkflowSettings } from "@/src/modules/hr/data/get-leave-workflow-settings";
import { resolveFinalApproverByPosition } from "@/src/modules/hr/data/resolve-leave-reporting-line";
import {
  applyLeaveApprove,
  applyLeaveRelease,
} from "@/src/modules/hr/lib/leave-balance-math";
import {
  isLeaveAwaitingApprovalDecision,
  resolveLeaveDecisionOutcome,
} from "@/src/modules/hr/lib/leave-decision-outcome";
import { leaveRequestAuditSuffix } from "@/src/modules/hr/lib/leave-request-audit-label";
import { canFinalApproverAct } from "@/src/modules/hr/lib/leave-reporting-line";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export type LeaveDecisionFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

/**
 * Decision semantics:
 * - Assigned pending approver may decide their step.
 * - `leave.manage` may override any pending step (HR).
 * - `leave.approve` alone may NOT override others' steps.
 * - Behaviour depends on org leave.workflow settings (manager→HR,
 *   direct manager, ack-then-final, etc.).
 */
export async function decideLeaveRequest(
  _previousState: LeaveDecisionFormState,
  formData: FormData,
): Promise<LeaveDecisionFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId");
  const decision = textValue(formData, "decision");
  const decisionComment = nullableText(formData, "decisionComment");

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    };
  }

  if (decision !== "APPROVE" && decision !== "REJECT") {
    return {
      status: "error",
      message: "Choose approve or reject.",
    };
  }

  if (decision === "REJECT" && !decisionComment) {
    return {
      status: "error",
      message: "A comment is required when rejecting leave.",
    };
  }

  let user;

  try {
    user = await requireCurrentUser();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active user account is required.",
    };
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
      acknowledgements: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!request) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    };
  }

  if (!isLeaveAwaitingApprovalDecision(request.status)) {
    return {
      status: "error",
      message:
        request.status === LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT
          ? "This leave request is still awaiting acknowledgements."
          : "This leave request is no longer awaiting a decision.",
    };
  }

  const assignedStep =
    request.approvalSteps.find((step) => step.approverUserId === user.id) ??
    null;

  const capabilities = await getUserCapabilities();
  const canManageLeave = capabilities?.can("leave.manage") ?? false;
  const workflow = await getLeaveWorkflowSettings(request.organizationId);

  if (
    workflow.mode === "REPORTING_LINE_ACK_THEN_FINAL" &&
    !canFinalApproverAct({
      requireAllAcksBeforeFinal: workflow.requireAllAcksBeforeFinal,
      acknowledgements: request.acknowledgements,
    })
  ) {
    return {
      status: "error",
      message:
        "Final approval is blocked until all reporting-line acknowledgements are complete.",
    };
  }

  // Assigned approver first; HR leave.manage may override unassigned
  // or another user's pending step. leave.approve alone cannot override.
  const stepToDecide =
    assignedStep ??
    (canManageLeave ? (request.approvalSteps[0] ?? null) : null);

  if (!stepToDecide) {
    return {
      status: "error",
      message: "You are not the assigned approver for this leave request.",
    };
  }

  const outcome = resolveLeaveDecisionOutcome({
    decision,
    stepNumber: stepToDecide.stepNumber,
    canManageLeave,
    mode: workflow.mode,
  });

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();
  const quantity = request.requestedQuantity.toString();
  const awaitingStatuses = [
    LeaveRequestStatus.SUBMITTED,
    LeaveRequestStatus.PENDING_APPROVAL,
    LeaveRequestStatus.MANAGER_APPROVED,
  ] as const;

  try {
    await prisma.$transaction(async (transaction) => {
      const stepResult = await transaction.leaveApprovalStep.updateMany({
        where: {
          id: stepToDecide.id,
          status: LeaveApprovalStatus.PENDING,
        },
        data: {
          status:
            decision === "APPROVE"
              ? LeaveApprovalStatus.APPROVED
              : LeaveApprovalStatus.REJECTED,
          decidedAt: now,
          decisionComment,
          ...(assignedStep
            ? {}
            : {
                approverUserId: user.id,
              }),
        },
      });

      if (stepResult.count !== 1) {
        throw new Error(
          "This leave request was already decided by another approver.",
        );
      }

      if (outcome.kind === "advance_to_hr") {
        const requestResult = await transaction.leaveRequest.updateMany({
          where: {
            id: request.id,
            status: {
              in: [...awaitingStatuses],
            },
          },
          data: {
            status: LeaveRequestStatus.MANAGER_APPROVED,
            finalDecisionByUserId: null,
            finalDecisionComment: decisionComment,
          },
        });

        if (requestResult.count !== 1) {
          throw new Error(
            "This leave request is no longer awaiting a decision.",
          );
        }

        await transaction.leaveApprovalStep.create({
          data: {
            leaveRequestId: request.id,
            stepNumber: stepToDecide.stepNumber + 1,
            approverUserId: null,
            approverPositionId: null,
            status: LeaveApprovalStatus.PENDING,
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: user.id,
            moduleKey: "hr",
            action: "APPROVE",
            entityType: "LeaveRequest",
            entityId: request.id,
            description: `Manager approved leave request${leaveRequestAuditSuffix(request.requestNumber)} for ${request.employee.employeeNumber}; awaiting HR confirmation.`,
            newValues: {
              decision,
              decisionComment,
              status: LeaveRequestStatus.MANAGER_APPROVED,
              override: !assignedStep,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        return;
      }

      if (outcome.kind === "advance_to_final") {
        if (!workflow.finalApproverPositionId) {
          throw new Error(
            "Final approver position is not configured for this leave workflow.",
          );
        }

        const finalApprover = await resolveFinalApproverByPosition(
          workflow.finalApproverPositionId,
        );

        if (!finalApprover?.userId) {
          throw new Error(
            "The final approver could not be resolved for the next approval step.",
          );
        }

        const requestResult = await transaction.leaveRequest.updateMany({
          where: {
            id: request.id,
            status: {
              in: [...awaitingStatuses],
            },
          },
          data: {
            status: LeaveRequestStatus.PENDING_APPROVAL,
            finalDecisionByUserId: null,
            finalDecisionComment: decisionComment,
          },
        });

        if (requestResult.count !== 1) {
          throw new Error(
            "This leave request is no longer awaiting a decision.",
          );
        }

        await transaction.leaveApprovalStep.create({
          data: {
            leaveRequestId: request.id,
            stepNumber: stepToDecide.stepNumber + 1,
            approverUserId: finalApprover.userId,
            approverPositionId: finalApprover.positionId,
            status: LeaveApprovalStatus.PENDING,
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: user.id,
            moduleKey: "hr",
            action: "APPROVE",
            entityType: "LeaveRequest",
            entityId: request.id,
            description: `Manager approved leave request${leaveRequestAuditSuffix(request.requestNumber)} for ${request.employee.employeeNumber}; awaiting final approval.`,
            newValues: {
              decision,
              decisionComment,
              status: LeaveRequestStatus.PENDING_APPROVAL,
              finalApproverUserId: finalApprover.userId,
              override: !assignedStep,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        return;
      }

      const finalizedStatus =
        outcome.requestStatus === "APPROVED"
          ? LeaveRequestStatus.APPROVED
          : LeaveRequestStatus.REJECTED;
      const approved = outcome.requestStatus === "APPROVED";

      const requestResult = await transaction.leaveRequest.updateMany({
        where: {
          id: request.id,
          status: {
            in: [...awaitingStatuses],
          },
        },
        data: {
          status: finalizedStatus,
          approvedAt: approved ? now : null,
          rejectedAt: approved ? null : now,
          finalDecisionByUserId: user.id,
          finalDecisionComment: decisionComment,
        },
      });

      if (requestResult.count !== 1) {
        throw new Error("This leave request is no longer awaiting a decision.");
      }

      if (request.leaveBalanceId) {
        const balance = await transaction.employeeLeaveBalance.findUnique({
          where: {
            id: request.leaveBalanceId,
          },
          select: {
            id: true,
            reserved: true,
            taken: true,
            availableBalance: true,
          },
        });

        if (!balance) {
          throw new Error(
            "The leave balance for this request no longer exists.",
          );
        }

        const snapshot = {
          reserved: balance.reserved.toString(),
          taken: balance.taken.toString(),
          availableBalance: balance.availableBalance.toString(),
        };

        const next =
          outcome.applyBalance === "approve"
            ? applyLeaveApprove(snapshot, quantity)
            : applyLeaveRelease(snapshot, quantity);

        const balanceResult = await transaction.employeeLeaveBalance.updateMany(
          {
            where: {
              id: balance.id,
              reserved: balance.reserved,
              taken: balance.taken,
              availableBalance: balance.availableBalance,
            },
            data: {
              reserved: new Prisma.Decimal(next.reserved),
              taken: new Prisma.Decimal(next.taken),
              availableBalance: new Prisma.Decimal(next.availableBalance),
              lastCalculatedAt: now,
            },
          },
        );

        if (balanceResult.count !== 1) {
          throw new Error(
            "Leave balance changed concurrently. Refresh and try again.",
          );
        }

        await transaction.leaveBalanceTransaction.create({
          data: {
            employeeId: request.employeeId,
            contractId: request.contractId,
            leaveTypeId: request.leaveTypeId,
            leaveBalanceId: balance.id,
            transactionType:
              outcome.applyBalance === "approve"
                ? LeaveBalanceTransactionType.LEAVE_TAKEN
                : LeaveBalanceTransactionType.REQUEST_RELEASED,
            quantity: request.requestedQuantity,
            balanceBefore: balance.availableBalance,
            balanceAfter: new Prisma.Decimal(next.availableBalance),
            effectiveDate: approved ? request.startDate : now,
            referenceType: "LeaveRequest",
            referenceId: request.id,
            description: approved
              ? `Leave taken for approved request${leaveRequestAuditSuffix(request.requestNumber)}.`
              : `Released reserved leave for rejected request${leaveRequestAuditSuffix(request.requestNumber)}.`,
            createdByUserId: user.id,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: approved ? "APPROVE" : "REJECT",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `${approved ? "Approved" : "Rejected"} leave request${leaveRequestAuditSuffix(request.requestNumber)} for ${request.employee.employeeNumber}.`,
          newValues: {
            decision,
            decisionComment,
            status: finalizedStatus,
            override: !assignedStep,
            hrConfirmation: stepToDecide.stepNumber > 1,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    if (outcome.kind === "advance_to_hr") {
      try {
        const hrUsers = await findUsersWithPermission(
          request.organizationId,
          "leave.manage",
        );
        const recipients = hrUsers
          .filter((hrUser) => hrUser.id !== user.id)
          .map((hrUser) => ({
            userId: hrUser.id,
            email: hrUser.email,
            name: `${hrUser.firstName} ${hrUser.lastName}`,
            sendEmail: Boolean(hrUser.email),
          }));

        if (recipients.length > 0) {
          await createSystemNotification({
            title: "Leave awaiting HR confirmation",
            message: `${request.employee.firstName} ${request.employee.lastName}'s ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved by their manager and needs HR confirmation.`,
            severity: NotificationSeverity.INFORMATION,
            moduleKey: "hr",
            actionUrl: `/people/leave/${request.id}`,
            relatedType: "LeaveRequest",
            relatedId: request.id,
            recipients,
            email: {
              subject: `HR confirmation · ${request.requestNumber ?? "Leave request"}`,
              actionLabel: "Review leave request",
            },
          });
        }
      } catch (notificationError) {
        console.error(
          "Leave advanced to HR but notification failed:",
          notificationError,
        );
      }

      const employeeUser = request.employee.user;

      if (employeeUser?.isActive) {
        try {
          await createSystemNotification({
            title: "Leave approved by manager",
            message: `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved by your manager and is awaiting HR confirmation.`,
            severity: NotificationSeverity.INFORMATION,
            moduleKey: "hr",
            actionUrl: `/people/leave/${request.id}`,
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
              subject: `Manager approved · ${request.requestNumber ?? "Leave request"}`,
              actionLabel: "View leave request",
            },
          });
        } catch (notificationError) {
          console.error(
            "Leave advanced to HR but employee notification failed:",
            notificationError,
          );
        }
      }

      revalidatePath("/people/leave");
      revalidatePath(`/people/leave/${request.id}`);
      revalidatePath("/notifications");

      return {
        status: "success",
        message:
          "Leave request approved. It is now awaiting HR confirmation.",
      };
    }

    if (outcome.kind === "advance_to_final") {
      if (workflow.finalApproverPositionId) {
        try {
          const finalApprover = await resolveFinalApproverByPosition(
            workflow.finalApproverPositionId,
          );

          if (finalApprover?.userId) {
            await createSystemNotification({
              title: "Leave ready for final approval",
              message: `${request.employee.firstName} ${request.employee.lastName}'s ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved by their manager and needs your approval.`,
              severity: NotificationSeverity.INFORMATION,
              moduleKey: "hr",
              actionUrl: `/people/leave/${request.id}`,
              relatedType: "LeaveRequest",
              relatedId: request.id,
              recipients: [
                {
                  userId: finalApprover.userId,
                  email: finalApprover.userEmail,
                  name: finalApprover.userName,
                  sendEmail: Boolean(finalApprover.userEmail),
                },
              ],
              email: {
                subject: `Final approval · ${request.requestNumber ?? "Leave request"}`,
                actionLabel: "Review leave request",
              },
            });
          }
        } catch (notificationError) {
          console.error(
            "Leave advanced to final approver but notification failed:",
            notificationError,
          );
        }
      }

      const employeeUser = request.employee.user;

      if (employeeUser?.isActive) {
        try {
          await createSystemNotification({
            title: "Leave approved by manager",
            message: `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved by your manager and is awaiting final approval.`,
            severity: NotificationSeverity.INFORMATION,
            moduleKey: "hr",
            actionUrl: `/people/leave/${request.id}`,
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
              subject: `Manager approved · ${request.requestNumber ?? "Leave request"}`,
              actionLabel: "View leave request",
            },
          });
        } catch (notificationError) {
          console.error(
            "Leave advanced to final but employee notification failed:",
            notificationError,
          );
        }
      }

      revalidatePath("/people/leave");
      revalidatePath(`/people/leave/${request.id}`);
      revalidatePath("/notifications");

      return {
        status: "success",
        message:
          "Leave request approved. It is now awaiting final approval.",
      };
    }

    const approved = outcome.requestStatus === "APPROVED";
    const employeeUser = request.employee.user;

    if (employeeUser?.isActive) {
      try {
        await createSystemNotification({
          title: approved ? "Leave request approved" : "Leave request rejected",
          message: approved
            ? `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was approved.`
            : `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) was rejected${decisionComment ? `: ${decisionComment}` : "."}`,
          severity: approved
            ? NotificationSeverity.SUCCESS
            : NotificationSeverity.WARNING,
          moduleKey: "hr",
          actionUrl: `/people/leave/${request.id}`,
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
        });
      } catch (notificationError) {
        console.error(
          "Leave decision saved but employee notification failed:",
          notificationError,
        );
      }
    }

    revalidatePath("/people/leave");
    revalidatePath(`/people/leave/${request.id}`);
    revalidatePath("/people/leave/balances");
    revalidatePath("/notifications");

    return {
      status: "success",
      message: approved
        ? stepToDecide.stepNumber > 1
          ? "Leave request confirmed by HR."
          : "Leave request approved."
        : "Leave request rejected.",
    };
  } catch (error) {
    console.error("Unable to decide leave request:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave decision could not be saved.",
    };
  }
}
