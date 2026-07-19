import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import {
  MISSING_FILE_REMINDER_DEDUPE_DAYS,
  MISSING_FILE_REMINDER_NOTIFICATION_TITLE,
  addUtcDays,
  buildMissingFileReminderMessage,
} from "@/src/modules/hr/lib/missing-file-reminder";

export type MissingFileReminderResult = {
  notified: number;
  skippedNoUser: number;
  skippedDedupe: number;
  skippedComplete: number;
};

/**
 * Send in-app missing-file reminders to linked employee users.
 * Dedupes on relatedType+relatedId+stable title within 14 days.
 */
export async function sendMissingFileReminders(input: {
  employeeIds: string[];
  missingLabelsByEmployee: Map<string, string[]>;
  asOf?: Date;
}): Promise<MissingFileReminderResult> {
  const asOf = input.asOf ?? new Date();
  const dedupeSince = addUtcDays(asOf, -MISSING_FILE_REMINDER_DEDUPE_DAYS);

  let notified = 0;
  let skippedNoUser = 0;
  let skippedDedupe = 0;
  let skippedComplete = 0;

  for (const employeeId of input.employeeIds) {
    const missingLabels = input.missingLabelsByEmployee.get(employeeId) ?? [];
    if (missingLabels.length === 0) {
      skippedComplete += 1;
      continue;
    }

    const linkedUser = await prisma.user.findFirst({
      where: {
        employeeId,
        isActive: true,
        status: { not: "DISABLED" },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!linkedUser) {
      skippedNoUser += 1;
      continue;
    }

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType: "Employee",
        relatedId: employeeId,
        title: MISSING_FILE_REMINDER_NOTIFICATION_TITLE,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });

    if (existing) {
      skippedDedupe += 1;
      continue;
    }

    const message = buildMissingFileReminderMessage(missingLabels);

    await createSystemNotification({
      title: MISSING_FILE_REMINDER_NOTIFICATION_TITLE,
      message,
      moduleKey: "hr",
      actionUrl: "/me/documents",
      relatedType: "Employee",
      relatedId: employeeId,
      recipients: [
        {
          userId: linkedUser.id,
          email: linkedUser.email,
          name: `${linkedUser.firstName} ${linkedUser.lastName}`,
          sendEmail: false,
        },
      ],
    });

    notified += 1;
  }

  return { notified, skippedNoUser, skippedDedupe, skippedComplete };
}
