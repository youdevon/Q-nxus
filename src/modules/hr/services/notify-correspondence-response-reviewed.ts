import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { correspondenceNotificationActionUrl } from "@/src/modules/hr/lib/correspondence-notification-backfill";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export const CORRESPONDENCE_RESPONSE_REVIEWED_NOTIFICATION_TITLE =
  "Your letter response was reviewed";

/**
 * Notifies the employee when HR marks their response as reviewed.
 * Idempotent per response record.
 */
export async function notifyCorrespondenceResponseReviewed(
  responseId: string,
): Promise<void> {
  const response = await prisma.employeeCorrespondenceResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      status: true,
      correspondence: {
        select: {
          id: true,
          title: true,
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
      },
    },
  });

  if (!response || response.status !== "REVIEWED") {
    return;
  }

  const user = response.correspondence.employee.user;

  if (!user?.isActive) {
    return;
  }

  const existing = await prisma.notification.findFirst({
    where: {
      title: CORRESPONDENCE_RESPONSE_REVIEWED_NOTIFICATION_TITLE,
      relatedType: "EmployeeCorrespondenceResponse",
      relatedId: responseId,
      recipients: {
        some: { userId: user.id },
      },
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await createSystemNotification({
    title: CORRESPONDENCE_RESPONSE_REVIEWED_NOTIFICATION_TITLE,
    message: `HR has reviewed your response to “${response.correspondence.title}”.`,
    severity: NotificationSeverity.INFORMATION,
    moduleKey: "hr",
    actionUrl: correspondenceNotificationActionUrl(response.correspondence.id),
    relatedType: "EmployeeCorrespondenceResponse",
    relatedId: responseId,
    recipients: [
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        sendEmail: false,
      },
    ],
  });
}
