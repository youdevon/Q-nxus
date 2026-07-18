"use server";

import { revalidatePath } from "next/cache";

import {
  LeaveAcknowledgementStatus,
  LeaveApprovalStatus,
  LeaveRequestStatus,
  NotificationSeverity,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getLeaveWorkflowSettings } from "@/src/modules/hr/data/get-leave-workflow-settings";
import { resolveFinalApproverByPosition } from "@/src/modules/hr/data/resolve-leave-reporting-line";
import {
  allAcknowledgementsComplete,
  canAcknowledgeLeaveRequest,
} from "@/src/modules/hr/lib/leave-reporting-line";
import { leaveRequestAuditSuffix } from "@/src/modules/hr/lib/leave-request-audit-label";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export type LeaveAcknowledgeFormState = {
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

export async function acknowledgeLeaveRequest(
  _previousState: LeaveAcknowledgeFormState,
  formData: FormData,
): Promise<LeaveAcknowledgeFormState> {
  const leaveRequestId = textValue(formData, "leaveRequestId");
  const comment = nullableText(formData, "comment");

  if (!leaveRequestId) {
    return {
      status: "error",
      message: "The leave request could not be found.",
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
    where: { id: leaveRequestId },
    include: {
      leaveType: { select: { name: true } },
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
      acknowledgements: {
        orderBy: { sequenceNumber: "asc" },
      },
    },
  });

  if (!request) {
    return {
      status: "error",
      message: "The leave request could not be found.",
    };
  }

  if (request.status !== LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT) {
    return {
      status: "error",
      message: "This leave request is not awaiting acknowledgement.",
    };
  }

  const capabilities = await getUserCapabilities();
  const canManageLeave = capabilities?.can("leave.manage") ?? false;
  const workflow = await getLeaveWorkflowSettings(request.organizationId);

  const permission = canAcknowledgeLeaveRequest({
    acknowledgements: request.acknowledgements.map((item) => ({
      sequenceNumber: item.sequenceNumber,
      status: item.status,
      acknowledgerUserId: item.acknowledgerUserId,
    })),
    actorUserId: user.id,
    ackOrder: workflow.ackOrder,
    canManageLeave,
  });

  if (!permission.ok) {
    return {
      status: "error",
      message: permission.reason,
    };
  }

  const target =
    request.acknowledgements.find(
      (item) =>
        item.sequenceNumber === permission.targetSequence &&
        item.status === LeaveAcknowledgementStatus.PENDING,
    ) ?? null;

  if (!target) {
    return {
      status: "error",
      message: "The acknowledgement step could not be found.",
    };
  }

  if (
    !canManageLeave &&
    target.acknowledgerUserId &&
    target.acknowledgerUserId !== user.id
  ) {
    return {
      status: "error",
      message: "You are not assigned to acknowledge this leave request.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  try {
    const advancedToApproval = await prisma.$transaction(async (transaction) => {
      const ackResult = await transaction.leaveRequestAcknowledgement.updateMany(
        {
          where: {
            id: target.id,
            status: LeaveAcknowledgementStatus.PENDING,
          },
          data: {
            status: LeaveAcknowledgementStatus.ACKNOWLEDGED,
            acknowledgedAt: now,
            comment,
            ...(canManageLeave && !target.acknowledgerUserId
              ? { acknowledgerUserId: user.id }
              : canManageLeave && target.acknowledgerUserId !== user.id
                ? { acknowledgerUserId: user.id }
                : {}),
          },
        },
      );

      if (ackResult.count !== 1) {
        throw new Error("This acknowledgement was already recorded.");
      }

      const remaining = await transaction.leaveRequestAcknowledgement.findMany({
        where: { leaveRequestId: request.id },
        select: { status: true },
      });

      const complete = allAcknowledgementsComplete(remaining);

      if (complete) {
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
            "The final approver could not be resolved after acknowledgements.",
          );
        }

        const requestResult = await transaction.leaveRequest.updateMany({
          where: {
            id: request.id,
            status: LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT,
          },
          data: {
            status: LeaveRequestStatus.PENDING_APPROVAL,
          },
        });

        if (requestResult.count !== 1) {
          throw new Error(
            "This leave request is no longer awaiting acknowledgement.",
          );
        }

        const existingSteps = await transaction.leaveApprovalStep.count({
          where: { leaveRequestId: request.id },
        });

        await transaction.leaveApprovalStep.create({
          data: {
            leaveRequestId: request.id,
            stepNumber: existingSteps + 1,
            approverUserId: finalApprover.userId,
            approverPositionId: finalApprover.positionId,
            status: LeaveApprovalStatus.PENDING,
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: user.id,
            moduleKey: "hr",
            action: "UPDATE",
            entityType: "LeaveRequest",
            entityId: request.id,
            description: `Acknowledged leave request${leaveRequestAuditSuffix(request.requestNumber)}; ready for final approval.`,
            newValues: {
              acknowledgementId: target.id,
              sequenceNumber: target.sequenceNumber,
              status: LeaveRequestStatus.PENDING_APPROVAL,
              finalApproverUserId: finalApprover.userId,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        return {
          complete: true as const,
          finalApprover,
        };
      }

      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "LeaveRequest",
          entityId: request.id,
          description: `Acknowledged leave request${leaveRequestAuditSuffix(request.requestNumber)} (step ${target.sequenceNumber}).`,
          newValues: {
            acknowledgementId: target.id,
            sequenceNumber: target.sequenceNumber,
            status: LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return { complete: false as const, finalApprover: null };
    });

    if (advancedToApproval.complete && advancedToApproval.finalApprover) {
      const finalApprover = advancedToApproval.finalApprover;

      try {
        await createSystemNotification({
          title: "Leave ready for final approval",
          message: `${request.employee.firstName} ${request.employee.lastName}'s ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) has been acknowledged and needs your approval.`,
          severity: NotificationSeverity.INFORMATION,
          moduleKey: "hr",
          actionUrl: `/people/leave/${request.id}`,
          relatedType: "LeaveRequest",
          relatedId: request.id,
          recipients: [
            {
              userId: finalApprover.userId!,
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
      } catch (notificationError) {
        console.error(
          "Leave acknowledgements complete but final approver notification failed:",
          notificationError,
        );
      }

      const employeeUser = request.employee.user;

      if (employeeUser?.isActive) {
        try {
          await createSystemNotification({
            title: "Leave awaiting final approval",
            message: `Your ${request.leaveType.name} request (${request.requestNumber ?? "leave request"}) has been acknowledged and is awaiting final approval.`,
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
              subject: `Awaiting approval · ${request.requestNumber ?? "Leave request"}`,
              actionLabel: "View leave request",
            },
          });
        } catch (notificationError) {
          console.error(
            "Leave acknowledgements complete but employee notification failed:",
            notificationError,
          );
        }
      }
    }

    revalidatePath("/people/leave");
    revalidatePath("/me/leave");
    revalidatePath(`/people/leave/${request.id}`);
    revalidatePath("/notifications");

    return {
      status: "success",
      message: advancedToApproval.complete
        ? "Acknowledged. The request is now awaiting final approval."
        : "Leave request acknowledged.",
    };
  } catch (error) {
    console.error("Unable to acknowledge leave request:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The acknowledgement could not be saved.",
    };
  }
}
