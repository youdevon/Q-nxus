import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { completeOnboardingTask } from "@/src/modules/hr/services/employee-lifecycle-cases";

export type SyncPayrollReadinessAfterActivateResult = {
  activateTaskCompleted: boolean;
  payrollTaskCompleted: boolean;
  payrollReady: boolean;
  blockingIssues: string[];
  /** Denormalized PayrollProfile.isPayrollReady was written to match live readiness. */
  payrollReadyFlagSynced: boolean;
  draftRunsRecalculated: number;
};

/**
 * After a contract activates: complete ACTIVATE_CONTRACT when open, sync the
 * denormalized payroll-ready flag from the live current-contract evaluation,
 * refresh open draft/approved pay-run salary snapshots, and auto-complete
 * PAYROLL_READINESS when setup is already ready. Otherwise notify payroll
 * staff (`payroll.setup` / `payroll.manage`) that setup still needs attention.
 * The activating actor is not notified unless they already hold those
 * permissions (employees must not receive other people's payroll alerts).
 *
 * Compensation itself is not copied — payroll always reads
 * `EmploymentContract` where `isCurrent` + ACTIVE for base salary / allowances.
 */
export async function syncPayrollReadinessAfterContractActivate(input: {
  employeeId: string;
  organizationId: string;
  actorUserId: string;
  contractId: string;
}): Promise<SyncPayrollReadinessAfterActivateResult> {
  const openCase = await prisma.employeeOnboardingCase.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["OPEN", "READY"] },
    },
    select: {
      id: true,
      tasks: {
        where: {
          code: { in: ["ACTIVATE_CONTRACT", "PAYROLL_READINESS"] },
          status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
        },
        select: {
          id: true,
          code: true,
          status: true,
        },
      },
    },
    orderBy: { openedAt: "desc" },
  });

  let activateTaskCompleted = false;
  let payrollTaskCompleted = false;

  const activateTask = openCase?.tasks.find(
    (task) => task.code === "ACTIVATE_CONTRACT",
  );

  if (activateTask) {
    await completeOnboardingTask({
      taskId: activateTask.id,
      completedByUserId: input.actorUserId,
      relatedEntityType: "EmploymentContract",
      relatedEntityId: input.contractId,
      notes: "Auto-completed when the employment contract was activated.",
    });
    activateTaskCompleted = true;
  }

  const { getEmployeePayrollSetup } = await import(
    "@/src/modules/payroll/data/get-employee-payroll-setup"
  );
  const setup = await getEmployeePayrollSetup(input.employeeId);
  const payrollReady = setup?.readiness?.isReady === true;
  const blockingIssues = setup?.readiness?.blockingIssues ?? [
    "Payroll setup could not be evaluated.",
  ];

  let payrollReadyFlagSynced = false;
  if (setup?.profile) {
    await prisma.payrollProfile.update({
      where: { employeeId: input.employeeId },
      data: { isPayrollReady: payrollReady },
    });
    payrollReadyFlagSynced = true;
  }

  let draftRunsRecalculated = 0;
  try {
    const contract = await prisma.employmentContract.findUnique({
      where: { id: input.contractId },
      select: { startDate: true },
    });
    const { recalculateAfterTaxChange } = await import(
      "@/src/modules/payroll/services/recalculate-after-tax-change"
    );
    const {
      taxYearFromAsOfKey,
      toStatutoryAsOfKey,
    } = await import("@/src/modules/payroll/lib/statutory-as-of");
    const asOf = contract?.startDate ?? new Date();
    const cascade = await recalculateAfterTaxChange({
      organizationId: input.organizationId,
      taxYear: taxYearFromAsOfKey(toStatutoryAsOfKey(asOf)),
      actorUserId: input.actorUserId,
      reason: "Employment contract activated",
      employeeId: input.employeeId,
      effectiveFrom: asOf,
    });
    draftRunsRecalculated = cascade.draftRunsRecalculated;
  } catch (error) {
    console.error(
      "Draft pay-run refresh failed after contract activate:",
      error,
    );
  }

  const payrollTask = openCase?.tasks.find(
    (task) => task.code === "PAYROLL_READINESS",
  );

  if (payrollTask && payrollReady) {
    await completeOnboardingTask({
      taskId: payrollTask.id,
      completedByUserId: input.actorUserId,
      relatedEntityType: "EmploymentContract",
      relatedEntityId: input.contractId,
      notes: "Auto-completed: payroll setup was already ready after activate.",
    });
    payrollTaskCompleted = true;
  } else if (!payrollReady) {
    // Staff only — never fan this out to the activating user unless they
    // already hold payroll.setup / payroll.manage. Employees must not see
    // other people's payroll readiness alerts.
    const { resolveRecipientsByPermissions } = await import(
      "@/src/modules/notifications/lib/resolve-notification-recipients"
    );

    const recipients = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.setup", "payroll.manage"],
      { sendEmail: true },
    );

    if (recipients.length > 0) {
      const employeeLabel = setup?.employee
        ? `${setup.employee.employeeNumber} — ${setup.employee.displayName}`
        : input.employeeId;
      const issues = blockingIssues.slice(0, 4).join("; ");

      try {
        await createSystemNotification({
          title: "Payroll setup needed after contract activation",
          message: `${employeeLabel} now has an active contract, but payroll is not ready yet: ${issues}`,
          severity: NotificationSeverity.WARNING,
          moduleKey: "payroll",
          actionUrl: `/payroll/employees/${input.employeeId}`,
          relatedType: "Employee",
          relatedId: input.employeeId,
          recipients,
          email: {
            subject: "Payroll setup needed after contract activation",
            actionLabel: "Open payroll setup",
          },
        });
      } catch (error) {
        console.error(
          "Unable to notify about payroll readiness after activate:",
          error,
        );
      }
    }
  }

  return {
    activateTaskCompleted,
    payrollTaskCompleted,
    payrollReady,
    blockingIssues,
    payrollReadyFlagSynced,
    draftRunsRecalculated,
  };
}
