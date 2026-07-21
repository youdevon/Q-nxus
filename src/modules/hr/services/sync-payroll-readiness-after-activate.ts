import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { completeOnboardingTask } from "@/src/modules/hr/services/employee-lifecycle-cases";

export type SyncPayrollReadinessAfterActivateResult = {
  activateTaskCompleted: boolean;
  payrollTaskCompleted: boolean;
  payrollReady: boolean;
  blockingIssues: string[];
};

/**
 * After a contract activates: complete ACTIVATE_CONTRACT when open, and
 * auto-complete PAYROLL_READINESS when setup is already ready. Otherwise
 * notify the actor that payroll setup still needs attention.
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
    const {
      mergeNotificationRecipients,
      recipientsFromUsers,
      resolveRecipientsByPermissions,
    } = await import(
      "@/src/modules/notifications/lib/resolve-notification-recipients"
    );

    const actor = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    const staff = await resolveRecipientsByPermissions(
      input.organizationId,
      ["payroll.setup", "payroll.manage"],
      { sendEmail: false },
    );
    const actorRecipients = recipientsFromUsers([actor], { sendEmail: true });
    const recipients = mergeNotificationRecipients(staff, actorRecipients);

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
  };
}
