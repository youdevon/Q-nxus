import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  mergeNotificationRecipients,
  recipientsFromUsers,
  resolveRecipientsByPermission,
} from "@/src/modules/notifications/lib/resolve-notification-recipients";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

async function safeNotify(label: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    console.error(`[notify-contract-lifecycle] ${label} failed:`, error);
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

async function usersOnPosition(positionId: string) {
  const assignments = await prisma.employeeAssignment.findMany({
    where: {
      positionId,
      isCurrent: true,
      employee: {
        user: { isActive: true },
      },
    },
    select: {
      employee: {
        select: {
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
    },
  });

  return assignments
    .map((row) => row.employee.user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
}

function employeeLabel(employee: {
  employeeNumber: string;
  firstName: string;
  lastName: string;
}) {
  return `${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}`;
}

export async function notifyContractPendingApproval(input: {
  organizationId: string;
  contractId: string;
  employeeId: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    userId?: string | null;
  };
  actorUserId: string;
  approverPositionId?: string | null;
}): Promise<void> {
  await safeNotify("pendingApproval", async () => {
    const fromPosition = input.approverPositionId
      ? recipientsFromUsers(await usersOnPosition(input.approverPositionId), {
          excludeUserIds: [input.actorUserId],
          sendEmail: false,
        })
      : [];
    const fallback =
      fromPosition.length > 0
        ? []
        : await resolveRecipientsByPermission(
            input.organizationId,
            "contracts.manage",
            { excludeUserIds: [input.actorUserId], sendEmail: false },
          );
    const recipients = mergeNotificationRecipients(fromPosition, fallback);
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Contract approval required: ${input.employee.firstName} ${input.employee.lastName}`,
      message: `${employeeLabel(input.employee)} has a contract awaiting your approval.`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/contracts/${input.contractId}`,
      relatedType: "EmploymentContract",
      relatedId: input.contractId,
      recipients,
    });
  });
}

export async function notifyContractDecision(input: {
  organizationId: string;
  contractId: string;
  employeeId: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    userId?: string | null;
  };
  decision: "APPROVE" | "REJECT";
  actorUserId: string;
  requesterUserId?: string | null;
}): Promise<void> {
  await safeNotify("decision", async () => {
    const employeeUser = await loadUser(input.employee.userId);
    const requester = await loadUser(input.requesterUserId);
    const managers =
      input.decision === "APPROVE"
        ? await resolveRecipientsByPermission(
            input.organizationId,
            "contracts.manage",
            { excludeUserIds: [input.actorUserId], sendEmail: false },
          )
        : [];

    const recipients = mergeNotificationRecipients(
      recipientsFromUsers([employeeUser, requester], {
        excludeUserIds: [input.actorUserId],
        sendEmail: false,
      }),
      managers,
    );
    if (recipients.length === 0) {
      return;
    }

    const verb = input.decision === "APPROVE" ? "approved" : "returned to draft";
    await createSystemNotification({
      title: `Contract ${verb}: ${input.employee.firstName} ${input.employee.lastName}`,
      message:
        input.decision === "APPROVE"
          ? `${employeeLabel(input.employee)} contract was approved and may need signatures / activation.`
          : `${employeeLabel(input.employee)} contract was rejected and returned to draft.`,
      severity:
        input.decision === "APPROVE"
          ? NotificationSeverity.INFORMATION
          : NotificationSeverity.WARNING,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/contracts/${input.contractId}`,
      relatedType: "EmploymentContract",
      relatedId: input.contractId,
      recipients,
    });
  });
}

export async function notifyContractSignatureNeeded(input: {
  organizationId: string;
  contractId: string;
  employeeId: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    userId?: string | null;
  };
  missingParty: "employee" | "org" | "both";
  actorUserId: string;
}): Promise<void> {
  await safeNotify("signatureNeeded", async () => {
    const lists = [];
    if (input.missingParty === "employee" || input.missingParty === "both") {
      const employeeUser = await loadUser(input.employee.userId);
      lists.push(
        recipientsFromUsers([employeeUser], {
          excludeUserIds: [input.actorUserId],
          sendEmail: false,
        }),
      );
    }
    if (input.missingParty === "org" || input.missingParty === "both") {
      lists.push(
        await resolveRecipientsByPermission(
          input.organizationId,
          "contracts.manage",
          { excludeUserIds: [input.actorUserId], sendEmail: false },
        ),
      );
    }
    const recipients = mergeNotificationRecipients(...lists);
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Contract signature needed: ${input.employee.firstName} ${input.employee.lastName}`,
      message: `${employeeLabel(input.employee)} contract is awaiting signature.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/contracts/${input.contractId}`,
      relatedType: "EmploymentContract",
      relatedId: input.contractId,
      recipients,
    });
  });
}

export async function notifyContractReadyToActivate(input: {
  organizationId: string;
  contractId: string;
  employeeId: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  actorUserId: string;
}): Promise<void> {
  await safeNotify("readyToActivate", async () => {
    const recipients = await resolveRecipientsByPermission(
      input.organizationId,
      "contracts.manage",
      { excludeUserIds: [input.actorUserId], sendEmail: false },
    );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Contract ready to activate: ${input.employee.firstName} ${input.employee.lastName}`,
      message: `${employeeLabel(input.employee)} signatures are complete. The contract can be activated.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/contracts/${input.contractId}`,
      relatedType: "EmploymentContract",
      relatedId: input.contractId,
      recipients,
    });
  });
}

/** Notify the employee's linked user that their contract is now active. */
export async function notifyContractActivated(input: {
  contractId: string;
  employeeId: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    userId?: string | null;
  };
  actorUserId: string;
}): Promise<void> {
  await safeNotify("activated", async () => {
    const employeeUser = await loadUser(input.employee.userId);
    const recipients = recipientsFromUsers([employeeUser], {
      excludeUserIds: [input.actorUserId],
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: "Your employment contract is active",
      message: `Your contract (${input.employee.employeeNumber}) is now active. You can review it in My contracts.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: "/me/contracts",
      relatedType: "EmploymentContract",
      relatedId: input.contractId,
      recipients,
    });
  });
}
