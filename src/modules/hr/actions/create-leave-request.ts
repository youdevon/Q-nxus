"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  LeaveBalanceTransactionType,
  LeaveRequestStatus,
  NotificationSeverity,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  resolveEmployeeSupervisor,
  describeSupervisorResolutionIssue,
} from "@/src/modules/hr/data/resolve-employee-supervisor";
import { getLeaveWorkflowSettings } from "@/src/modules/hr/data/get-leave-workflow-settings";
import {
  describeLeaveReportingLineIssue,
  resolveLeaveReportingLine,
} from "@/src/modules/hr/data/resolve-leave-reporting-line";
import {
  applyLeaveReserve,
  applyLeaveTakeDirect,
} from "@/src/modules/hr/lib/leave-balance-math";
import {
  isLeaveRequestMode,
  LEAVE_ON_BEHALF_PERMISSION,
  resolveLeaveRequestTargetEmployeeId,
} from "@/src/modules/hr/lib/leave-request-mode";
import {
  leaveWorkflowRequiresFinalApprover,
  leaveWorkflowUsesAcknowledgements,
} from "@/src/modules/hr/lib/leave-workflow-settings";
import { storeLeaveAttachmentFile } from "@/src/modules/hr/lib/store-leave-attachment";
import { validateContractLeaveRequest } from "@/src/modules/hr/services/validate-contract-leave-request";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type LeaveRequestFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildRequestNumber(sequence: number): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  return `LR-${stamp}-${String(sequence).padStart(4, "0")}`;
}

export async function createLeaveRequest(
  _previousState: LeaveRequestFormState,
  formData: FormData,
): Promise<LeaveRequestFormState> {
  const modeRaw = textValue(formData, "mode");

  if (!isLeaveRequestMode(modeRaw)) {
    return {
      status: "error",
      message: "Invalid leave request mode.",
    };
  }

  const mode = modeRaw;
  const permissionCheck =
    mode === "onBehalf"
      ? await requireActor(LEAVE_ON_BEHALF_PERMISSION)
      : await requireActor("leave.request");

  if (!permissionCheck.ok) {
    return {
      status: "error",
      message: permissionCheck.message,
    };
  }

  const actorCapabilities = permissionCheck.actor;

  let actorUser;

  try {
    actorUser = await requireCurrentUser();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active user account is required.",
    };
  }

  const targetResolution = resolveLeaveRequestTargetEmployeeId({
    mode,
    actorEmployeeId: actorCapabilities.employeeId,
    submittedEmployeeId: nullableText(formData, "employeeId"),
  });

  if (!targetResolution.ok) {
    return {
      status: "error",
      message: targetResolution.message,
      fieldErrors:
        mode === "onBehalf"
          ? { employeeId: targetResolution.message }
          : undefined,
    };
  }

  const targetEmployee = await prisma.employee.findFirst({
    where: {
      id: targetResolution.employeeId,
      organizationId: actorUser.organizationId,
      isArchived: false,
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!targetEmployee) {
    return {
      status: "error",
      message:
        mode === "onBehalf"
          ? "Select a valid employee in your organization."
          : "Your employee record could not be found.",
      fieldErrors:
        mode === "onBehalf"
          ? { employeeId: "Select a valid employee." }
          : undefined,
    };
  }

  const leaveTypeId = textValue(formData, "leaveTypeId");
  const contractId = textValue(formData, "contractId");
  const startDate = parseDate(textValue(formData, "startDate"));
  const endDate = parseDate(textValue(formData, "endDate"));
  const reason = nullableText(formData, "reason");
  const employeeComment = nullableText(formData, "employeeComment");
  const historicalRecord = formData.get("historicalRecord") === "on";

  const fieldErrors: Record<string, string> = {};

  if (historicalRecord && mode !== "onBehalf") {
    return {
      status: "error",
      message:
        "Past approved leave can only be recorded on behalf of an employee.",
    };
  }

  if (!leaveTypeId) {
    fieldErrors.leaveTypeId = "Select a leave type.";
  }

  if (!contractId) {
    fieldErrors.contractId = "Select the employment contract for this request.";
  }

  if (!startDate) {
    fieldErrors.startDate = "Enter the leave start date.";
  }

  if (!endDate) {
    fieldErrors.endDate = "Enter the leave end date.";
  }

  if (startDate && endDate && endDate < startDate) {
    fieldErrors.endDate = "The end date cannot be before the start date.";
  }

  if (historicalRecord && endDate) {
    const todayUtc = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );

    if (endDate.getTime() >= todayUtc.getTime()) {
      fieldErrors.endDate =
        "Historical leave must end before today. Uncheck past approved leave for future or current requests.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the leave request details.",
      fieldErrors,
    };
  }

  let validated;

  try {
    validated = await validateContractLeaveRequest({
      employeeId: targetEmployee.id,
      contractId,
      leaveTypeId,
      startDate: startDate!,
      endDate: endDate!,
      skipNotice: historicalRecord,
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be validated.",
    };
  }

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: targetEmployee.id,
      status: {
        in: [
          LeaveRequestStatus.SUBMITTED,
          LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT,
          LeaveRequestStatus.PENDING_APPROVAL,
          LeaveRequestStatus.MANAGER_APPROVED,
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
  });

  if (overlapping) {
    return {
      status: "error",
      message: overlapping.requestNumber
        ? `These dates overlap an existing leave request (${overlapping.requestNumber}).`
        : "These dates overlap an existing leave request.",
    };
  }

  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!historicalRecord && validated.requiresDocument && !attachmentFile) {
    return {
      status: "error",
      message:
        "This leave type requires a supporting document for the requested duration.",
      fieldErrors: {
        attachment: "Upload a supporting document.",
      },
    };
  }

  const workflow = await getLeaveWorkflowSettings(targetEmployee.organizationId);
  const needsFinalApprover = leaveWorkflowRequiresFinalApprover(workflow.mode);
  const usesAcknowledgements = leaveWorkflowUsesAcknowledgements(workflow.mode);

  type ApprovalStepCreate = {
    stepNumber: number;
    approverUserId: string | null;
    approverPositionId: string | null;
    status: "PENDING";
  };

  let acknowledgementNodes: Awaited<
    ReturnType<typeof resolveLeaveReportingLine>
  >["acknowledgementChain"] = [];
  let approvalStepsCreate: ApprovalStepCreate[] = [];
  let supervisor: Awaited<ReturnType<typeof resolveEmployeeSupervisor>> = null;
  let finalApprover: Awaited<
    ReturnType<typeof resolveLeaveReportingLine>
  >["finalApprover"] | null = null;
  let initialStatus: LeaveRequestStatus = LeaveRequestStatus.PENDING_APPROVAL;

  if (historicalRecord) {
    initialStatus = LeaveRequestStatus.APPROVED;
  } else {
    if (needsFinalApprover && !workflow.finalApproverPositionId) {
      return {
        status: "error",
        message:
          "Leave workflow requires a final approver position. Ask HR to configure it under People → Leave workflow.",
      };
    }

    supervisor =
      workflow.mode === "FINAL_ONLY" || usesAcknowledgements
        ? null
        : await resolveEmployeeSupervisor(targetEmployee.id);

    if (
      workflow.mode !== "FINAL_ONLY" &&
      !usesAcknowledgements &&
      !supervisor?.supervisorUserId
    ) {
      return {
        status: "error",
        message: describeSupervisorResolutionIssue(supervisor),
      };
    }

    let reportingLine: Awaited<
      ReturnType<typeof resolveLeaveReportingLine>
    > | null = null;

    if (needsFinalApprover && workflow.finalApproverPositionId) {
      reportingLine = await resolveLeaveReportingLine({
        employeeId: targetEmployee.id,
        organizationId: targetEmployee.organizationId,
        finalApproverPositionId: workflow.finalApproverPositionId,
      });

      if (reportingLine.issue) {
        return {
          status: "error",
          message: describeLeaveReportingLineIssue(reportingLine),
        };
      }
    }

    acknowledgementNodes =
      usesAcknowledgements && reportingLine
        ? reportingLine.acknowledgementChain.filter((node) => node.userId)
        : [];

    initialStatus =
      usesAcknowledgements && acknowledgementNodes.length > 0
        ? LeaveRequestStatus.AWAITING_ACKNOWLEDGEMENT
        : LeaveRequestStatus.PENDING_APPROVAL;

    finalApprover = reportingLine?.finalApprover ?? null;

    if (usesAcknowledgements) {
      if (acknowledgementNodes.length === 0 && finalApprover?.userId) {
        approvalStepsCreate = [
          {
            stepNumber: 1,
            approverUserId: finalApprover.userId,
            approverPositionId: finalApprover.positionId,
            status: "PENDING",
          },
        ];
      }
    } else if (workflow.mode === "FINAL_ONLY" && finalApprover?.userId) {
      approvalStepsCreate = [
        {
          stepNumber: 1,
          approverUserId: finalApprover.userId,
          approverPositionId: finalApprover.positionId,
          status: "PENDING",
        },
      ];
    } else if (supervisor?.supervisorUserId) {
      approvalStepsCreate = [
        {
          stepNumber: 1,
          approverUserId: supervisor.supervisorUserId,
          approverPositionId: supervisor.supervisorPositionId,
          status: "PENDING",
        },
      ];
    }

    if (approvalStepsCreate.length === 0 && acknowledgementNodes.length === 0) {
      return {
        status: "error",
        message: "No leave approver could be assigned for this request.",
      };
    }
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const leaveRequest = await prisma.$transaction(async (transaction) => {
      const sequence =
        (await transaction.leaveRequest.count({
          where: {
            organizationId: targetEmployee.organizationId,
          },
        })) + 1;

      const requestNumber = buildRequestNumber(sequence);

      const created = await transaction.leaveRequest.create({
        data: {
          organizationId: targetEmployee.organizationId,
          employeeId: targetEmployee.id,
          contractId: validated.contractId,
          leaveTypeId: validated.leaveTypeId,
          leaveBalanceId: validated.leaveBalanceId,
          requestNumber,
          startDate: startDate!,
          endDate: endDate!,
          requestedQuantity: validated.requestedQuantity,
          reason,
          employeeComment,
          status: initialStatus,
          submittedAt: new Date(),
          ...(historicalRecord
            ? {
                approvedAt: new Date(),
                finalDecisionByUserId: actorUser.id,
                finalDecisionComment:
                  "Recorded as past approved leave during cutover.",
              }
            : {}),
          createdByUserId: actorUser.id,
          days: {
            create: validated.days.map((day) => ({
              leaveDate: day.leaveDate,
              quantity: day.quantity,
              isWorkingDay: day.isWorkingDay,
              isPublicHoliday: day.isPublicHoliday,
            })),
          },
          ...(approvalStepsCreate.length > 0
            ? {
                approvalSteps: {
                  create: approvalStepsCreate,
                },
              }
            : {}),
          ...(acknowledgementNodes.length > 0
            ? {
                acknowledgements: {
                  create: acknowledgementNodes.map((node) => ({
                    sequenceNumber: node.sequenceNumber,
                    positionId: node.positionId,
                    acknowledgerUserId: node.userId,
                    acknowledgerEmployeeId: node.employeeId,
                    status: "PENDING",
                  })),
                },
              }
            : {}),
        },
        include: {
          leaveType: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      if (attachmentFile) {
        const stored = await storeLeaveAttachmentFile({
          employee: targetEmployee,
          leaveRequestId: created.id,
          file: attachmentFile,
        });

        await transaction.leaveAttachment.create({
          data: {
            leaveRequestId: created.id,
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
            uploadedByUserId: actorUser.id,
          },
        });
      }

      if (validated.leaveBalanceId) {
        const balance = await transaction.employeeLeaveBalance.findUnique({
          where: {
            id: validated.leaveBalanceId,
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
        const quantity = validated.requestedQuantity.toString();
        const next = historicalRecord
          ? applyLeaveTakeDirect(snapshot, quantity)
          : applyLeaveReserve(snapshot, quantity);

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
              lastCalculatedAt: new Date(),
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
            employeeId: targetEmployee.id,
            contractId: validated.contractId,
            leaveTypeId: validated.leaveTypeId,
            leaveBalanceId: balance.id,
            transactionType: historicalRecord
              ? LeaveBalanceTransactionType.LEAVE_TAKEN
              : LeaveBalanceTransactionType.REQUEST_RESERVED,
            quantity: validated.requestedQuantity,
            balanceBefore: balance.availableBalance,
            balanceAfter: new Prisma.Decimal(next.availableBalance),
            effectiveDate: startDate!,
            referenceType: "LeaveRequest",
            referenceId: created.id,
            description: historicalRecord
              ? `Historical leave taken for request ${requestNumber}.`
              : `Reserved leave for request ${requestNumber}.`,
            createdByUserId: actorUser.id,
          },
        });
      }

      const actorLabel = `${actorUser.firstName} ${actorUser.lastName}`.trim();
      const auditDescription = historicalRecord
        ? `Recorded historical leave ${requestNumber} for ${targetEmployee.employeeNumber} by ${actorLabel}.`
        : mode === "onBehalf"
          ? `Submitted leave request ${requestNumber} on behalf of ${targetEmployee.employeeNumber} by ${actorLabel}.`
          : `Submitted leave request ${requestNumber} for ${targetEmployee.employeeNumber}.`;

      await transaction.auditEvent.create({
        data: {
          userId: actorUser.id,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "LeaveRequest",
          entityId: created.id,
          description: auditDescription,
          newValues: {
            requestNumber,
            leaveTypeId: validated.leaveTypeId,
            contractId: validated.contractId,
            employeeId: targetEmployee.id,
            mode,
            historicalRecord,
            requestedOnBehalf:
              mode === "onBehalf"
                ? {
                    employeeId: targetEmployee.id,
                    employeeNumber: targetEmployee.employeeNumber,
                    byUserId: actorUser.id,
                    byUserName: actorLabel,
                  }
                : null,
            startDate: startDate!.toISOString(),
            endDate: endDate!.toISOString(),
            requestedQuantity: validated.requestedQuantity.toString(),
            status: initialStatus,
            workflowMode: historicalRecord ? null : workflow.mode,
            approverUserId: approvalStepsCreate[0]?.approverUserId ?? null,
            acknowledgementCount: acknowledgementNodes.length,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created;
    });

    if (!historicalRecord) {
      const quantityLabel = leaveRequest.requestedQuantity.toString();
      const dateRange = `${startDate!.toISOString().slice(0, 10)} to ${endDate!.toISOString().slice(0, 10)}`;
      const employeeDisplayName = `${targetEmployee.firstName} ${targetEmployee.lastName}`;
      const requestSubject =
        mode === "onBehalf"
          ? `${employeeDisplayName} (requested by ${actorUser.firstName} ${actorUser.lastName})`
          : employeeDisplayName;

      if (acknowledgementNodes.length > 0) {
        try {
          await createSystemNotification({
            title: "Leave acknowledgement required",
            message: `${requestSubject} requested ${quantityLabel} day(s) of ${leaveRequest.leaveType.name} from ${dateRange}. Please acknowledge before final approval.`,
            severity: NotificationSeverity.INFORMATION,
            moduleKey: "hr",
            actionUrl: `/people/leave/${leaveRequest.id}`,
            relatedType: "LeaveRequest",
            relatedId: leaveRequest.id,
            recipients: acknowledgementNodes
              .filter((node) => node.userId)
              .map((node) => ({
                userId: node.userId!,
                email: node.userEmail,
                name: node.userName,
                sendEmail: Boolean(node.userEmail),
              })),
            email: {
              subject: `Leave acknowledgement · ${leaveRequest.requestNumber}`,
              actionLabel: "Review leave request",
            },
          });
        } catch (notificationError) {
          console.error(
            "Leave request created but acknowledgement notification failed:",
            notificationError,
          );
        }
      } else {
        const notifyUserId =
          approvalStepsCreate[0]?.approverUserId ??
          finalApprover?.userId ??
          supervisor?.supervisorUserId ??
          null;
        const notifyEmail =
          finalApprover?.userId === notifyUserId
            ? finalApprover.userEmail
            : supervisor?.supervisorUserEmail;
        const notifyName =
          finalApprover?.userId === notifyUserId
            ? finalApprover.userName
            : supervisor?.supervisorUserName;

        if (notifyUserId) {
          try {
            await createSystemNotification({
              title: "Leave approval required",
              message: `${requestSubject} requested ${quantityLabel} day(s) of ${leaveRequest.leaveType.name} from ${dateRange}.`,
              severity: NotificationSeverity.INFORMATION,
              moduleKey: "hr",
              actionUrl: `/people/leave/${leaveRequest.id}`,
              relatedType: "LeaveRequest",
              relatedId: leaveRequest.id,
              recipients: [
                {
                  userId: notifyUserId,
                  email: notifyEmail,
                  name: notifyName,
                  sendEmail: Boolean(notifyEmail),
                },
              ],
              email: {
                subject: `Leave approval required · ${leaveRequest.requestNumber}`,
                actionLabel: "Review leave request",
              },
            });
          } catch (notificationError) {
            console.error(
              "Leave request created but approver notification failed:",
              notificationError,
            );
          }
        }
      }
    }

    revalidatePath("/people/leave");
    revalidatePath("/me/leave");
    revalidatePath("/me/leave/new");
    revalidatePath("/people/leave/new");
    revalidatePath("/people/leave/balances");
    revalidatePath(`/people/leave/${leaveRequest.id}`);
    revalidatePath("/notifications");

    redirect(`/people/leave/${leaveRequest.id}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message:
          "A leave request with this reference already exists. Try again.",
      };
    }

    console.error("Unable to create leave request:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave request could not be submitted.",
    };
  }
}
