"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export async function createTestNotification(): Promise<void> {
  const actor = await requireActor("administration.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: actor.actor.userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return;
  }

  await createSystemNotification({
    title: "Q-NXUS notification test",
    message:
      "The system-wide notification service is working. Future leave requests, approvals and workflow alerts will appear here.",
    severity: "INFORMATION",
    moduleKey: "administration",
    actionUrl: "/notifications",
    relatedType: "SYSTEM_TEST",
    recipients: [
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        sendEmail: true,
      },
    ],
    email: {
      subject: "Q-NXUS notification test",
      textBody: "The Q-NXUS notification and SMTP service is working.",
      bodyHtml:
        "<p>The Q-NXUS notification and SMTP service is working.</p><p>Future leave requests, approval tasks and workflow alerts can use this shared service.</p>",
      actionLabel: "Open notifications",
      priority: "NORMAL",
    },
  });

  revalidatePath("/notifications");

  redirect("/notifications");
}
