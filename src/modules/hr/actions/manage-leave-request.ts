"use server";

import { revalidatePath } from "next/cache";

import {
  LeaveAcknowledgementStatus,
  LeaveApprovalStatus,
  LeaveBalanceTransactionType,
  LeaveRequestStatus,
  NotificationSeverity,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentEmployeeUser } from "@/src/modules/auth/data/get-current-user";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import {
  applyLeaveCancelTaken,
  applyLeaveRelease,
} from "@/src/modules/hr/lib/leave-balance-math";
import { leaveRequestAuditSuffix } from "@/src/modules/hr/lib/leave-request-audit-label";

export type LeaveLifecycleFormState = {
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

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

async function loadOwnedLeaveRequest(leaveRequestId: string) {
  const user = await requireCurrentEmployeeUser();

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
  });

  if (!request) {
    return {
      ok: false as const,
      error: "The leave request could not be found.",
    };
  }

  if (request.employeeId !== user.employeeId) {
    return {
      ok: false as const,
      error: "Only the employee who owns this request can change it.",
    };
  }

  return {
    ok: true as const,
    user,
    request,
  };
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
  requestId: string;
  requestNumber: string | null;
  leaveTypeName: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  recipients: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }[];
}) {
  const uniqueRecipients = [
    ...new Map(
      recipients
        .filter((recipient) => recipient.isActive)
        .map((recipient) => [recipient.id, recipient]),
    ).values(),
  ];

  if (uniqueRecipients.length === 0) {
    return;
  }

  await createSystemNotification({
    title,
    message,
    severity,
    moduleKey: "hr",
    actionUrl: `/people/leave/${requestId}`,
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
  });
}

export async function withdrawLeaveRequest(
  _previousState: LeaveLifecycleFormState,
  formData: FormData,
): Promise<LeaveLifecycleFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId");
  const comment = nullableText(formData, "comment");

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    };
  }

  let loaded;

  try {
    loaded = await loadOwnedLeaveRequest(leaveRequestId);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active employee-linked user is required.",
    };
  }

  if (!loaded.ok) {
    return {
      status: "error",
      message: loaded.error,
    };
  }

  const { user, request } = loaded;

  if (
    request.status !== LeaveRequestStatus.SUBMITTED &&
    request.status !== LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT &&
    request.status !== LeaveRequestStatus.PENDING_APPROVAL &&
    request.status !== LeaveRequestStatus.MANAGER_APPROVED
  ) {
    return {
      status: "error",
      message: "Only pending leave requests can be withdrawn.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();
  const quantity = request.requestedQuantity.toString();

  try {
    await prisma.$transaction(async (transaction) => {
      const requestResult = await transaction.leaveRequest.updateMany({
        where: {
          id: request.id,
          status: {
            in: [
              LeaveRequestStatus.SUBMITTED,
              LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT,
              LeaveRequestStatus.PENDING_APPROVAL,
              LeaveRequestStatus.MANAGER_APPROVED,
            ],
          },
        },
        data: {
          status: LeaveRequestStatus.WITHDRAWN,
          withdrawnAt: now,
          finalDecisionComment: comment,
        },
      });

      if (requestResult.count !== 1) {
        throw new Error("Only pending leave requests can be withdrawn.");
      }

      await transaction.leaveApprovalStep.updateMany({
        where: {
          leaveRequestId: request.id,
          status: LeaveApprovalStatus.PENDING,
        },
        data: {
          status: LeaveApprovalStatus.CANCELLED,
          decidedAt: now,
          decisionComment: comment ?? "Request withdrawn by employee.",
        },
      });

      await transaction.leaveRequestAcknowledgement.updateMany({
        where: {
          leaveRequestId: request.id,
          status: LeaveAcknowledgementStatus.PENDING,
        },
        data: {
          status: LeaveAcknowledgementStatus.CANCELLED,
          comment: comment ?? "Request withdrawn by employee.",
        },
      });

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

        const next = applyLeaveRelease(
          {
            reserved: balance.reserved.toString(),
            taken: balance.taken.toString(),
            availableBalance: balance.availableBalance.toString(),
          },
          quantity,
        );

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
            transactionType: LeaveBalanceTransactionType.REQUEST_RELEASED,
            quantity: request.requestedQuantity,
            balanceBefore: balance.availableBalance,
            balanceAfter: new Prisma.Decimal(next.availableBalance),
            effectiveDate: now,
            referenceType: "LeaveRequest",
            referenceId: request.id,
            description: `Released reserved leave for withdrawn request${leaveRequestAuditSuffix(request.requestNumber)}.`,
            createdByUserId: user.id,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: "WITHDRAW",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `Withdrew leave request${leaveRequestAuditSuffix(request.requestNumber)}.`,
          newValues: {
            status: LeaveRequestStatus.WITHDRAWN,
            comment,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

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
          .filter((approver): approver is NonNullable<typeof approver> =>
            Boolean(approver),
          ),
      });
    } catch (notificationError) {
      console.error(
        "Leave request withdrawn but approver notification failed:",
        notificationError,
      );
    }

    revalidatePath("/people/leave");
    revalidatePath(`/people/leave/${request.id}`);
    revalidatePath("/people/leave/balances");
    revalidatePath("/notifications");

    return {
      status: "success",
      message: "Leave request withdrawn.",
    };
  } catch (error) {
    console.error("Unable to withdraw leave request:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be withdrawn.",
    };
  }
}

export async function cancelLeaveRequest(
  _previousState: LeaveLifecycleFormState,
  formData: FormData,
): Promise<LeaveLifecycleFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId");
  const comment = nullableText(formData, "comment");

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    };
  }

  if (!comment) {
    return {
      status: "error",
      message: "A comment is required when cancelling approved leave.",
    };
  }

  let loaded;

  try {
    loaded = await loadOwnedLeaveRequest(leaveRequestId);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active employee-linked user is required.",
    };
  }

  if (!loaded.ok) {
    return {
      status: "error",
      message: loaded.error,
    };
  }

  const { user, request } = loaded;

  if (request.status !== LeaveRequestStatus.APPROVED) {
    return {
      status: "error",
      message: "Only approved leave requests can be cancelled.",
    };
  }

  const today = startOfUtcDay(new Date());
  const leaveStart = startOfUtcDay(request.startDate);

  if (leaveStart <= today) {
    return {
      status: "error",
      message:
        "Approved leave that has already started cannot be cancelled from this screen.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();
  const quantity = request.requestedQuantity.toString();

  try {
    await prisma.$transaction(async (transaction) => {
      const requestResult = await transaction.leaveRequest.updateMany({
        where: {
          id: request.id,
          status: LeaveRequestStatus.APPROVED,
        },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          cancelledAt: now,
          finalDecisionComment: comment,
        },
      });

      if (requestResult.count !== 1) {
        throw new Error("Only approved leave requests can be cancelled.");
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

        const next = applyLeaveCancelTaken(
          {
            reserved: balance.reserved.toString(),
            taken: balance.taken.toString(),
            availableBalance: balance.availableBalance.toString(),
          },
          quantity,
        );

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
            transactionType: LeaveBalanceTransactionType.REVERSAL,
            quantity: request.requestedQuantity,
            balanceBefore: balance.availableBalance,
            balanceAfter: new Prisma.Decimal(next.availableBalance),
            effectiveDate: now,
            referenceType: "LeaveRequest",
            referenceId: request.id,
            description: `Reversed taken leave for cancelled request${leaveRequestAuditSuffix(request.requestNumber)}.`,
            createdByUserId: user.id,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: "CANCEL",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `Cancelled approved leave request${leaveRequestAuditSuffix(request.requestNumber)}.`,
          newValues: {
            status: LeaveRequestStatus.CANCELLED,
            comment,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

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
          .filter((approver): approver is NonNullable<typeof approver> =>
            Boolean(approver),
          ),
      });
    } catch (notificationError) {
      console.error(
        "Leave request cancelled but approver notification failed:",
        notificationError,
      );
    }

    revalidatePath("/people/leave");
    revalidatePath(`/people/leave/${request.id}`);
    revalidatePath("/people/leave/balances");
    revalidatePath("/notifications");

    return {
      status: "success",
      message: "Approved leave cancelled.",
    };
  } catch (error) {
    console.error("Unable to cancel leave request:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be cancelled.",
    };
  }
}
