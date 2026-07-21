import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  mergeNotificationRecipients,
  recipientsFromUsers,
  resolveRecipientsByPermission,
  resolveRecipientsByPermissions,
} from "@/src/modules/notifications/lib/resolve-notification-recipients";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

async function safeNotify(
  label: string,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[notify-payroll] ${label} failed:`, error);
  }
}

async function loadUser(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
}

/** Draft created or returned to draft — other payroll managers should review. */
export async function notifyPayRunReadyForReview(input: {
  organizationId: string;
  payRunId: string;
  runNumber: string;
  periodName?: string | null;
  actorUserId: string;
  reason: "created" | "approval_cleared";
}): Promise<void> {
  await safeNotify("payRunReadyForReview", async () => {
    const recipients = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    const period = input.periodName ? ` · ${input.periodName}` : "";
    const title =
      input.reason === "created"
        ? `Pay run ready for review: ${input.runNumber}`
        : `Pay run needs re-approval: ${input.runNumber}`;
    const message =
      input.reason === "created"
        ? `Draft pay run ${input.runNumber}${period} is ready for review.`
        : `Approval was cleared on ${input.runNumber}${period}. Review figures and approve again before posting.`;

    await createSystemNotification({
      title,
      message,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}`,
      relatedType: "PayRun",
      relatedId: input.payRunId,
      recipients,
    });
  });
}

/** Notify the maker that their draft was approved. */
export async function notifyPayRunApproved(input: {
  organizationId: string;
  payRunId: string;
  runNumber: string;
  createdById: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("payRunApproved", async () => {
    const maker = await loadUser(input.createdById);
    const recipients = recipientsFromUsers([maker], {
      excludeUserIds: [input.actorUserId],
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Pay run approved: ${input.runNumber}`,
      message: `Pay run ${input.runNumber} was approved and is ready to post.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}`,
      relatedType: "PayRun",
      relatedId: input.payRunId,
      recipients,
    });
  });
}

/** Notify other payroll managers that a run was posted. */
export async function notifyPayRunPosted(input: {
  organizationId: string;
  payRunId: string;
  runNumber: string;
  periodName?: string | null;
  actorUserId: string;
  createdById?: string | null;
  approvedById?: string | null;
}): Promise<void> {
  await safeNotify("payRunPosted", async () => {
    const managers = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    const maker = await loadUser(input.createdById);
    const approver = await loadUser(input.approvedById);
    const recipients = mergeNotificationRecipients(
      managers,
      recipientsFromUsers([maker, approver], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
    );
    if (recipients.length === 0) {
      return;
    }

    const period = input.periodName ? ` · ${input.periodName}` : "";
    await createSystemNotification({
      title: `Pay run posted: ${input.runNumber}`,
      message: `Pay run ${input.runNumber}${period} is posted. Figures are locked.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}`,
      relatedType: "PayRun",
      relatedId: input.payRunId,
      recipients,
    });
  });
}

/** In-app notice to employees with linked users when payslips are released. */
export async function notifyPayslipsReleased(input: {
  payRunId: string;
  runNumber: string;
  periodName: string;
  employees: Array<{
    userId: string | null | undefined;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}): Promise<void> {
  await safeNotify("payslipsReleased", async () => {
    const recipients = recipientsFromUsers(
      input.employees.map((employee) =>
        employee.userId
          ? {
              id: employee.userId,
              email: employee.email,
              firstName: employee.firstName,
              lastName: employee.lastName,
              isActive: true,
            }
          : null,
      ),
      { sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Payslip available: ${input.periodName}`,
      message: `Your payslip for ${input.periodName} (${input.runNumber}) is available in self-service.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: "/me/payslips",
      relatedType: "PayRun",
      relatedId: input.payRunId,
      recipients,
    });
  });
}

export async function notifyAchBatchPendingApproval(input: {
  organizationId: string;
  payRunId: string;
  batchId: string;
  batchNumber: string;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("achBatchPending", async () => {
    const recipients = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Payment batch awaiting approval: ${input.batchNumber}`,
      message: `ACH payment batch ${input.batchNumber} needs approval before file generation.`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}/payments/${input.batchId}`,
      relatedType: "AchPaymentBatch",
      relatedId: input.batchId,
      recipients,
    });
  });
}

export async function notifyAchBatchApproved(input: {
  batchId: string;
  batchNumber: string;
  payRunId: string;
  preparedByUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("achBatchApproved", async () => {
    const preparer = await loadUser(input.preparedByUserId);
    const recipients = recipientsFromUsers([preparer], {
      excludeUserIds: [input.actorUserId],
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Payment batch approved: ${input.batchNumber}`,
      message: `Batch ${input.batchNumber} was approved and can be generated.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}/payments/${input.batchId}`,
      relatedType: "AchPaymentBatch",
      relatedId: input.batchId,
      recipients,
    });
  });
}

export async function notifyAchBatchFileGenerated(input: {
  organizationId: string;
  payRunId: string;
  batchId: string;
  batchNumber: string;
  fileName: string;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("achBatchGenerated", async () => {
    const recipients = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Payment file ready: ${input.batchNumber}`,
      message: `Batch ${input.batchNumber} generated ${input.fileName}. Download is available.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}/payments/${input.batchId}`,
      relatedType: "AchPaymentBatch",
      relatedId: input.batchId,
      recipients,
    });
  });
}

export async function notifyStatutoryOverridePending(input: {
  organizationId: string;
  employeeId: string;
  overrideId: string;
  employeeLabel: string;
  periodEndKey: string;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("statutoryOverridePending", async () => {
    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.statutory_override.approve", "payroll.manage"],
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Statutory override pending: ${input.employeeLabel}`,
      message: `Override for ${input.employeeLabel} · period ending ${input.periodEndKey} awaits approval.`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year`,
      relatedType: "EmployeePayrollStatutoryOverride",
      relatedId: input.overrideId,
      recipients,
    });
  });
}

export async function notifyStatutoryOverrideDecided(input: {
  employeeId: string;
  overrideId: string;
  employeeLabel: string;
  decision: "approve" | "reject";
  requestedByUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("statutoryOverrideDecided", async () => {
    const requester = await loadUser(input.requestedByUserId);
    const recipients = recipientsFromUsers([requester], {
      excludeUserIds: [input.actorUserId],
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    const verb = input.decision === "approve" ? "approved" : "rejected";
    await createSystemNotification({
      title: `Statutory override ${verb}: ${input.employeeLabel}`,
      message: `Your statutory override request for ${input.employeeLabel} was ${verb}.`,
      severity:
        input.decision === "approve"
          ? NotificationSeverity.INFORMATION
          : NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year`,
      relatedType: "EmployeePayrollStatutoryOverride",
      relatedId: input.overrideId,
      recipients,
    });
  });
}

/** Notify the employee when a bank payment allocation is returned or rejected. */
export async function notifyPaymentAllocationReturned(input: {
  allocationId: string;
  employeeId: string;
  payRunId: string;
  outcome: "RETURNED" | "REJECTED";
  amount: number;
  currencyCode: string;
  accountMasked: string;
  returnReason?: string | null;
}): Promise<void> {
  await safeNotify("paymentAllocationReturned", async () => {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
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
    });
    const recipients = recipientsFromUsers([employee?.user], {
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    const verb =
      input.outcome === "REJECTED" ? "rejected by the bank" : "returned";
    const reason = input.returnReason?.trim()
      ? ` Reason: ${input.returnReason.trim()}.`
      : "";

    await createSystemNotification({
      title: "Payroll payment could not be deposited",
      message: `A payment of ${input.amount.toFixed(2)} ${input.currencyCode} to account ${input.accountMasked} was ${verb}.${reason} Please update your bank details with HR/payroll.`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: "/me",
      relatedType: "PayrollPaymentAllocation",
      relatedId: input.allocationId,
      recipients,
    });
  });
}
