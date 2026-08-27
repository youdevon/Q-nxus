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

type LoadedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

async function loadUser(
  userId: string | null | undefined,
): Promise<LoadedUser | null> {
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

function userDisplayName(
  user: { firstName: string; lastName: string; email: string } | null,
): string {
  if (!user) {
    return "Unknown user";
  }
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

/** Appended to payroll messages so the inbox is a browsable approval history. */
function approvalTrail(parts: {
  initiatedBy?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  postedBy?: string | null;
  decidedBy?: string | null;
  decision?: "approve" | "reject";
}): string {
  const lines: string[] = [];
  if (parts.initiatedBy) {
    lines.push(`Initiated by ${parts.initiatedBy}`);
  }
  if (parts.decision === "reject" && (parts.rejectedBy || parts.decidedBy)) {
    lines.push(`Rejected by ${parts.rejectedBy ?? parts.decidedBy}`);
  } else if (
    parts.approvedBy ||
    (parts.decision === "approve" && parts.decidedBy)
  ) {
    lines.push(`Approved by ${parts.approvedBy ?? parts.decidedBy}`);
  } else if (parts.decidedBy) {
    lines.push(`Decided by ${parts.decidedBy}`);
  }
  if (parts.postedBy) {
    lines.push(`Posted by ${parts.postedBy}`);
  }
  return lines.length > 0 ? `\n\n${lines.join(" · ")}` : "";
}

async function organizationIdForEmployee(
  employeeId: string,
): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true },
  });
  return employee?.organizationId ?? null;
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
    const actor = await loadUser(input.actorUserId);
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
    const body =
      input.reason === "created"
        ? `Draft pay run ${input.runNumber}${period} is ready for review.`
        : `Approval was cleared on ${input.runNumber}${period}. Review figures and approve again before posting.`;

    await createSystemNotification({
      title,
      message: `${body}${approvalTrail({ initiatedBy: userDisplayName(actor) })}`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/runs/${input.payRunId}`,
      relatedType: "PayRun",
      relatedId: input.payRunId,
      recipients,
    });
  });
}

/** Notify that a draft was approved and posting is the next maker-checker step. */
export async function notifyPayRunApproved(input: {
  organizationId: string;
  payRunId: string;
  runNumber: string;
  createdById: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("payRunApproved", async () => {
    const maker = await loadUser(input.createdById);
    const approver = await loadUser(input.actorUserId);
    const managers = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([maker], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Pay run approved — ready to post: ${input.runNumber}`,
      message: `Pay run ${input.runNumber} was approved. A different payroll officer from the approver can post it.${approvalTrail(
        {
          initiatedBy: userDisplayName(maker),
          approvedBy: userDisplayName(approver),
        },
      )}`,
      severity: NotificationSeverity.WARNING,
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
    const poster = await loadUser(input.actorUserId);
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
      message: `Pay run ${input.runNumber}${period} is posted. Figures are locked.${approvalTrail(
        {
          initiatedBy: userDisplayName(maker),
          approvedBy: userDisplayName(approver),
          postedBy: userDisplayName(poster),
        },
      )}`,
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
    const actor = await loadUser(input.actorUserId);
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
      message: `ACH payment batch ${input.batchNumber} needs approval before file generation.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
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
  organizationId: string;
  batchId: string;
  batchNumber: string;
  payRunId: string;
  preparedByUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("achBatchApproved", async () => {
    const preparer = await loadUser(input.preparedByUserId);
    const approver = await loadUser(input.actorUserId);
    const managers = await resolveRecipientsByPermission(
      input.organizationId,
      "payroll.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([preparer], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Payment batch approved: ${input.batchNumber}`,
      message: `Batch ${input.batchNumber} was approved and can be generated.${approvalTrail(
        {
          initiatedBy: userDisplayName(preparer),
          approvedBy: userDisplayName(approver),
        },
      )}`,
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
    const actor = await loadUser(input.actorUserId);
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
      message: `Batch ${input.batchNumber} generated ${input.fileName}. Download is available.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
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
    const actor = await loadUser(input.actorUserId);
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
      message: `Override for ${input.employeeLabel} · period ending ${input.periodEndKey} awaits approval.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
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
    const decider = await loadUser(input.actorUserId);
    const organizationId = await organizationIdForEmployee(input.employeeId);
    const managers = organizationId
      ? await resolveRecipientsByPermissions(
          organizationId,
          ["payroll.statutory_override.approve", "payroll.manage"],
          { excludeUserIds: [input.actorUserId], sendEmail: false },
        )
      : [];
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([requester], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    const verb = input.decision === "approve" ? "approved" : "rejected";
    await createSystemNotification({
      title: `Statutory override ${verb}: ${input.employeeLabel}`,
      message: `Statutory override for ${input.employeeLabel} was ${verb}.${approvalTrail(
        {
          initiatedBy: userDisplayName(requester),
          decidedBy: userDisplayName(decider),
          decision: input.decision,
        },
      )}`,
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

export async function notifyTaxYearAdjustmentPending(input: {
  organizationId: string;
  employeeId: string;
  adjustmentId: string;
  employeeLabel: string;
  taxYear: number;
  adjustmentType: string;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("taxYearAdjustmentPending", async () => {
    const actor = await loadUser(input.actorUserId);
    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.tax_adjustments.approve", "payroll.manage"],
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Tax-year adjustment pending: ${input.employeeLabel}`,
      message: `${input.adjustmentType.replaceAll("_", " ")} adjustment for ${input.employeeLabel} · ${input.taxYear} awaits approval.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year?year=${input.taxYear}`,
      relatedType: "EmployeeTaxYearAdjustment",
      relatedId: input.adjustmentId,
      recipients,
    });
  });
}

export async function notifyTaxYearAdjustmentDecided(input: {
  employeeId: string;
  adjustmentId: string;
  employeeLabel: string;
  taxYear: number;
  decision: "approve" | "reject";
  enteredByUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("taxYearAdjustmentDecided", async () => {
    const requester = await loadUser(input.enteredByUserId);
    const decider = await loadUser(input.actorUserId);
    const organizationId = await organizationIdForEmployee(input.employeeId);
    const managers = organizationId
      ? await resolveRecipientsByPermissions(
          organizationId,
          ["payroll.tax_adjustments.approve", "payroll.manage"],
          { excludeUserIds: [input.actorUserId], sendEmail: false },
        )
      : [];
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([requester], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    const verb = input.decision === "approve" ? "approved" : "rejected";
    await createSystemNotification({
      title: `Tax-year adjustment ${verb}: ${input.employeeLabel}`,
      message: `Tax-year adjustment for ${input.employeeLabel} · ${input.taxYear} was ${verb}.${approvalTrail(
        {
          initiatedBy: userDisplayName(requester),
          decidedBy: userDisplayName(decider),
          decision: input.decision,
        },
      )}`,
      severity:
        input.decision === "approve"
          ? NotificationSeverity.INFORMATION
          : NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year?year=${input.taxYear}`,
      relatedType: "EmployeeTaxYearAdjustment",
      relatedId: input.adjustmentId,
      recipients,
    });
  });
}

export async function notifyEarningTreatmentPending(input: {
  organizationId: string;
  employeeId: string;
  overrideId: string;
  employeeLabel: string;
  taxTreatment: string;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("earningTreatmentPending", async () => {
    const actor = await loadUser(input.actorUserId);
    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.tax_treatment.override", "payroll.manage"],
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Earning treatment pending: ${input.employeeLabel}`,
      message: `Treatment override (${input.taxTreatment.replaceAll("_", " ")}) for ${input.employeeLabel} awaits approval.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year`,
      relatedType: "EmployeeEarningTreatmentOverride",
      relatedId: input.overrideId,
      recipients,
    });
  });
}

export async function notifyEarningTreatmentDecided(input: {
  employeeId: string;
  overrideId: string;
  employeeLabel: string;
  decision: "approve" | "reject";
  enteredByUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("earningTreatmentDecided", async () => {
    const requester = await loadUser(input.enteredByUserId);
    const decider = await loadUser(input.actorUserId);
    const organizationId = await organizationIdForEmployee(input.employeeId);
    const managers = organizationId
      ? await resolveRecipientsByPermissions(
          organizationId,
          ["payroll.tax_treatment.override", "payroll.manage"],
          { excludeUserIds: [input.actorUserId], sendEmail: false },
        )
      : [];
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([requester], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    const verb = input.decision === "approve" ? "approved" : "rejected";
    await createSystemNotification({
      title: `Earning treatment ${verb}: ${input.employeeLabel}`,
      message: `Earning treatment override for ${input.employeeLabel} was ${verb}.${approvalTrail(
        {
          initiatedBy: userDisplayName(requester),
          decidedBy: userDisplayName(decider),
          decision: input.decision,
        },
      )}`,
      severity:
        input.decision === "approve"
          ? NotificationSeverity.INFORMATION
          : NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year`,
      relatedType: "EmployeeEarningTreatmentOverride",
      relatedId: input.overrideId,
      recipients,
    });
  });
}

export async function notifyAnnualProjectionReviewPending(input: {
  organizationId: string;
  employeeId: string;
  projectionId: string;
  employeeLabel: string;
  taxYear: number;
  version: number;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("annualProjectionReviewPending", async () => {
    const actor = await loadUser(input.actorUserId);
    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.tax_projection.approve", "payroll.manage"],
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Annual PAYE projection review: ${input.employeeLabel}`,
      message: `Projection v${input.version} for ${input.employeeLabel} · ${input.taxYear} awaits approval.${approvalTrail(
        { initiatedBy: userDisplayName(actor) },
      )}`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year?year=${input.taxYear}`,
      relatedType: "EmployeeAnnualPayrollProjection",
      relatedId: input.projectionId,
      recipients,
    });
  });
}

export async function notifyAnnualProjectionApproved(input: {
  employeeId: string;
  projectionId: string;
  employeeLabel: string;
  taxYear: number;
  version: number;
  generatedByUserId: string | null;
  actorUserId: string;
  appliedPeriodCount?: number;
  skippedPostedPeriodCount?: number;
  recommendedPayePerPeriod?: number | null;
}): Promise<void> {
  await safeNotify("annualProjectionApproved", async () => {
    const generator = await loadUser(input.generatedByUserId);
    const approver = await loadUser(input.actorUserId);
    const organizationId = await organizationIdForEmployee(input.employeeId);
    const managers = organizationId
      ? await resolveRecipientsByPermissions(
          organizationId,
          ["payroll.tax_projection.approve", "payroll.manage"],
          { excludeUserIds: [input.actorUserId], sendEmail: false },
        )
      : [];
    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([generator], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    const applied = input.appliedPeriodCount ?? 0;
    const skipped = input.skippedPostedPeriodCount ?? 0;
    const amountNote =
      input.recommendedPayePerPeriod != null
        ? ` Recommended PAYE / period ${input.recommendedPayePerPeriod.toFixed(2)}.`
        : "";
    const applyNote =
      applied > 0
        ? ` Auto-applied approved overrides to ${applied} open period(s)${
            skipped > 0 ? `; skipped ${skipped} posted` : ""
          }. Draft pay runs recalculated.`
        : skipped > 0
          ? ` No open periods to override (${skipped} posted skipped).`
          : "";

    await createSystemNotification({
      title: `Annual PAYE projection approved: ${input.employeeLabel}`,
      message: `Projection v${input.version} for ${input.employeeLabel} · ${input.taxYear} was approved.${amountNote}${applyNote}${approvalTrail(
        {
          initiatedBy: userDisplayName(generator),
          approvedBy: userDisplayName(approver),
        },
      )}`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year?year=${input.taxYear}`,
      relatedType: "EmployeeAnnualPayrollProjection",
      relatedId: input.projectionId,
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

/**
 * Contract / employment ends mid-month — sticky / projection PAYE was not
 * auto-applied for that period; officers must enter PAYE manually.
 */
export async function notifyPayeMidMonthManualRequired(input: {
  organizationId: string;
  employeeId: string;
  employeeLabel: string;
  periodEndKeys: string[];
  employmentEndDate: string;
  actorUserId: string;
}): Promise<void> {
  if (input.periodEndKeys.length === 0) {
    return;
  }

  await safeNotify("payeMidMonthManualRequired", async () => {
    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      [
        "payroll.statutory_override.request",
        "payroll.statutory_override.approve",
        "payroll.tax_projection.approve",
        "payroll.manage",
      ],
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    const periods = input.periodEndKeys.join(", ");
    await createSystemNotification({
      title: `PAYE manual entry required: ${input.employeeLabel}`,
      message: `${input.employeeLabel} employment ends mid-month on ${input.employmentEndDate}. PAYE was not auto-applied for period(s) ending ${periods}. Enter a statutory PAYE override for the worked portion of that month.`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "payroll",
      actionUrl: `/payroll/employees/${input.employeeId}/tax-year`,
      relatedType: "Employee",
      relatedId: input.employeeId,
      recipients,
    });
  });
}
