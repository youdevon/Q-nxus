import {
  NotificationSeverity,
  PerformanceAppraisalStatus,
} from "@/generated/prisma/client";
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
    console.error(`[notify-appraisal] ${label} failed:`, error);
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

function startOfUtcDay(value = new Date()): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function notifyAppraisalSubmitted(input: {
  organizationId: string;
  appraisalId: string;
  employeeId: string;
  employeeLabel: string;
  supervisorUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("submitted", async () => {
    const supervisor = await loadUser(input.supervisorUserId);
    const recipients =
      supervisor && supervisor.isActive
        ? recipientsFromUsers([supervisor], {
            excludeUserIds: [input.actorUserId],
            sendEmail: false,
          })
        : await resolveRecipientsByPermission(
            input.organizationId,
            "people.manage",
            { excludeUserIds: [input.actorUserId], sendEmail: false },
          );
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Appraisal submitted: ${input.employeeLabel}`,
      message: `Performance appraisal for ${input.employeeLabel} was submitted and needs supervisor review.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/appraisals/${input.appraisalId}`,
      relatedType: "PerformanceAppraisal",
      relatedId: input.appraisalId,
      recipients,
    });
  });
}

export async function notifyAppraisalReviewed(input: {
  appraisalId: string;
  employeeId: string;
  employeeLabel: string;
  employeeUserId: string | null;
  actorUserId: string;
}): Promise<void> {
  await safeNotify("reviewed", async () => {
    const employeeUser = await loadUser(input.employeeUserId);
    const recipients = recipientsFromUsers([employeeUser], {
      excludeUserIds: [input.actorUserId],
      sendEmail: false,
    });
    if (recipients.length === 0) {
      return;
    }

    await createSystemNotification({
      title: `Appraisal reviewed: ${input.employeeLabel}`,
      message: `Your performance appraisal has been reviewed by your supervisor and awaits acknowledgement.`,
      severity: NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${input.employeeId}/appraisals/${input.appraisalId}`,
      relatedType: "PerformanceAppraisal",
      relatedId: input.appraisalId,
      recipients,
    });
  });
}

export type AppraisalDueReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

/** Remind supervisors (or people.manage) when appraisals are due within 14 days or overdue. */
export async function notifyAppraisalDueReminders(): Promise<AppraisalDueReminderResult> {
  const today = startOfUtcDay();
  const windowEnd = addUtcDays(today, 14);

  const appraisals = await prisma.performanceAppraisal.findMany({
    where: {
      reviewDueDate: { not: null, lte: windowEnd },
      status: {
        in: [
          PerformanceAppraisalStatus.DRAFT,
          PerformanceAppraisalStatus.IN_PROGRESS,
          PerformanceAppraisalStatus.SUBMITTED,
          PerformanceAppraisalStatus.SUPERVISOR_REVIEWED,
        ],
      },
    },
    select: {
      id: true,
      title: true,
      reviewDueDate: true,
      supervisorUserId: true,
      employee: {
        select: {
          id: true,
          organizationId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  let notified = 0;
  let skipped = 0;
  const dedupeSince = addUtcDays(today, -14);

  for (const appraisal of appraisals) {
    if (!appraisal.reviewDueDate) {
      skipped += 1;
      continue;
    }

    const daysUntil = Math.ceil(
      (appraisal.reviewDueDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const windowLabel = daysUntil < 0 ? "overdue" : "due soon";
    const employeeLabel = `${appraisal.employee.firstName} ${appraisal.employee.lastName}`;
    const title = `Appraisal ${windowLabel}: ${employeeLabel}`;

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType: "PerformanceAppraisal",
        relatedId: appraisal.id,
        title,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const supervisor = await loadUser(appraisal.supervisorUserId);
    const supervisorRecipients = recipientsFromUsers([supervisor], {
      sendEmail: false,
    });
    const fallback =
      supervisorRecipients.length > 0
        ? []
        : await resolveRecipientsByPermission(
            appraisal.employee.organizationId,
            "people.manage",
            { sendEmail: false },
          );
    const recipients = mergeNotificationRecipients(
      supervisorRecipients,
      fallback,
    );
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const dueIso = appraisal.reviewDueDate.toISOString().slice(0, 10);
    await createSystemNotification({
      title,
      message: `${appraisal.employee.employeeNumber} — ${employeeLabel}: review due ${dueIso}${appraisal.title ? ` (${appraisal.title})` : ""}.`,
      severity:
        daysUntil < 0
          ? NotificationSeverity.WARNING
          : NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${appraisal.employee.id}/appraisals/${appraisal.id}`,
      relatedType: "PerformanceAppraisal",
      relatedId: appraisal.id,
      recipients,
    });
    notified += 1;
  }

  return { considered: appraisals.length, notified, skipped };
}
