import { EmailPriority, NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { queueEmail } from "./email-queue";
import { wrapSystemEmailHtml } from "./render-email-template";

export type SystemNotificationRecipient = {
  userId: string;
  email?: string | null;
  name?: string | null;
  sendEmail?: boolean;
};

export type CreateSystemNotificationInput = {
  title: string;
  message: string;
  severity?: NotificationSeverity;
  moduleKey: string;
  actionUrl?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  expiresAt?: Date | null;
  recipients: SystemNotificationRecipient[];
  email?: {
    subject?: string;
    textBody?: string;
    bodyHtml?: string;
    actionLabel?: string | null;
    priority?: EmailPriority;
  };
};

function absoluteActionUrl(
  actionUrl: string | null | undefined,
): string | null {
  if (!actionUrl) {
    return null;
  }

  if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) {
    return actionUrl;
  }

  const baseUrl =
    process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  return `${baseUrl}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`;
}

export async function createSystemNotification(
  input: CreateSystemNotificationInput,
) {
  if (input.recipients.length === 0) {
    throw new Error("At least one notification recipient is required.");
  }

  const uniqueRecipients = [
    ...new Map(
      input.recipients.map((recipient) => [recipient.userId, recipient]),
    ).values(),
  ];

  const notification = await prisma.notification.create({
    data: {
      title: input.title.trim(),
      message: input.message.trim(),
      severity: input.severity ?? NotificationSeverity.INFORMATION,
      moduleKey: input.moduleKey,
      actionUrl: input.actionUrl ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      expiresAt: input.expiresAt ?? null,
      recipients: {
        create: uniqueRecipients.map((recipient) => ({
          userId: recipient.userId,
          status: "UNREAD",
        })),
      },
    },
  });

  if (input.email) {
    const actionUrl = absoluteActionUrl(input.actionUrl);

    for (const recipient of uniqueRecipients) {
      if (recipient.sendEmail === false || !recipient.email) {
        continue;
      }

      const bodyHtml = input.email.bodyHtml ?? `<p>${input.message}</p>`;

      await queueEmail({
        notificationId: notification.id,
        moduleKey: input.moduleKey,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        recipientName: recipient.name ?? null,
        subject: input.email.subject ?? input.title,
        textBody: input.email.textBody ?? input.message,
        htmlBody: wrapSystemEmailHtml({
          heading: input.title,
          bodyHtml,
          actionLabel:
            input.email.actionLabel ?? (actionUrl ? "Open in Q-NXUS" : null),
          actionUrl,
        }),
        priority: input.email.priority ?? EmailPriority.NORMAL,
      });
    }
  }

  return notification;
}
