"use server";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

import { revalidatePath } from "next/cache";

import { queueEmail } from "@/src/modules/notifications/services/email-queue";
import { processEmailQueue } from "@/src/modules/notifications/services/process-email-queue";
import { wrapSystemEmailHtml } from "@/src/modules/notifications/services/render-email-template";
import { verifySmtpConnection } from "@/src/modules/notifications/services/smtp-transport";

export type SystemEmailActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendSystemTestEmail(
  _previousState: SystemEmailActionState,
  formData: FormData,
): Promise<SystemEmailActionState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_domain_setting",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const recipientEmail = textValue(formData, "recipientEmail");

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return {
      status: "error",
      message: "Enter a valid test recipient email.",
    };
  }

  try {
    await verifySmtpConnection();

    await queueEmail({
      moduleKey: "administration",
      relatedType: "SMTP_TEST",
      recipientEmail,
      subject: "Q-NXUS SMTP test",
      textBody:
        "This message confirms that Q-NXUS SMTP delivery is configured.",
      htmlBody: wrapSystemEmailHtml({
        heading: "SMTP test successful",
        bodyHtml:
          "<p>This message confirms that Q-NXUS can connect to the configured SMTP service and deliver system notifications.</p>",
      }),
      priority: "HIGH",
      maximumAttempts: 1,
    });

    const result = await processEmailQueue(5);

    revalidatePath("/administration/notifications/email");

    if (result.sent < 1) {
      return {
        status: "error",
        message:
          "The test email was queued but was not sent. Review the delivery log.",
      };
    }

    return {
      status: "success",
      message: `Test email sent to ${recipientEmail}.`,
    };
  } catch (error: unknown) {
    console.error("SMTP test failed:", error);

    return {
      status: "error",
      message: error instanceof Error ? error.message : "The SMTP test failed.",
    };
  }
}

export async function processSystemEmailQueue(): Promise<void> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_domain_setting",
  );
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await processEmailQueue(50);

  revalidatePath("/administration/notifications/email");
}
