import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export const CORRESPONDENCE_RESPONSE_SUBMITTED_NOTIFICATION_TITLE =
  "Employee letter response submitted";

/**
 * Notifies people.manage users when an employee submits a response.
 * Idempotent per response record.
 */
export async function notifyCorrespondenceResponseSubmitted(
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
          employeeId: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
        },
      },
    },
  });

  if (!response || response.status !== "OPEN") {
    return;
  }

  const { correspondence } = response;
  const employee = correspondence.employee;
  const actionUrl = `/people/employees/${correspondence.employeeId}/documents/${correspondence.id}`;

  const letter = await prisma.employeeCorrespondence.findUnique({
    where: { id: correspondence.id },
    select: { organizationId: true },
  });

  if (!letter) {
    return;
  }

  const hrRecipients = await prisma.user.findMany({
    where: {
      organizationId: letter.organizationId,
      isActive: true,
      roles: {
        some: {
          status: "ACTIVE",
          role: {
            isActive: true,
            permissions: {
              some: {
                permission: {
                  code: "people.manage",
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (hrRecipients.length === 0) {
    return;
  }

  const existing = await prisma.notification.findFirst({
    where: {
      title: CORRESPONDENCE_RESPONSE_SUBMITTED_NOTIFICATION_TITLE,
      relatedType: "EmployeeCorrespondenceResponse",
      relatedId: responseId,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await createSystemNotification({
    title: CORRESPONDENCE_RESPONSE_SUBMITTED_NOTIFICATION_TITLE,
    message: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) submitted a response to “${correspondence.title}”.`,
    severity: NotificationSeverity.INFORMATION,
    moduleKey: "hr",
    actionUrl,
    relatedType: "EmployeeCorrespondenceResponse",
    relatedId: responseId,
    recipients: hrRecipients.map((user) => ({
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      sendEmail: false,
    })),
  });
}
