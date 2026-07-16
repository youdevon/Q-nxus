import { EmailDeliveryStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { getSmtpConfiguration } from "./smtp-config";
import { getSmtpTransport } from "./smtp-transport";

export type EmailQueueProcessingResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

function retryDelayMinutes(attemptNumber: number): number {
  if (attemptNumber <= 1) {
    return 5;
  }

  if (attemptNumber === 2) {
    return 30;
  }

  return 120;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 4000);
  }

  return String(error).slice(0, 4000);
}

export async function processEmailQueue(
  batchSize = 20,
): Promise<EmailQueueProcessingResult> {
  const configuration = getSmtpConfiguration();

  if (!configuration.enabled) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const now = new Date();

  const pending = await prisma.emailDelivery.findMany({
    where: {
      status: EmailDeliveryStatus.PENDING,
      OR: [
        {
          nextAttemptAt: null,
        },
        {
          nextAttemptAt: {
            lte: now,
          },
        },
      ],
    },
    orderBy: [
      {
        priority: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
    take: Math.max(1, Math.min(batchSize, 100)),
  });

  const result: EmailQueueProcessingResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const transport = getSmtpTransport();

  for (const email of pending) {
    const claimed = await prisma.emailDelivery.updateMany({
      where: {
        id: email.id,
        status: EmailDeliveryStatus.PENDING,
      },
      data: {
        status: EmailDeliveryStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;

    const attemptNumber = email.attemptCount + 1;

    const attempt = await prisma.emailDeliveryAttempt.create({
      data: {
        emailDeliveryId: email.id,
        attemptNumber,
        status: EmailDeliveryStatus.PROCESSING,
      },
    });

    try {
      const message = await transport.sendMail({
        from: {
          name: configuration.fromName,
          address: configuration.fromEmail,
        },
        replyTo: configuration.replyTo ?? undefined,
        to: email.recipientName
          ? {
              name: email.recipientName,
              address: email.recipientEmail,
            }
          : email.recipientEmail,
        subject: email.subject,
        text: email.textBody ?? undefined,
        html: email.htmlBody ?? undefined,
      });

      await prisma.$transaction([
        prisma.emailDelivery.update({
          where: {
            id: email.id,
          },
          data: {
            status: EmailDeliveryStatus.SENT,
            attemptCount: attemptNumber,
            sentAt: new Date(),
            processingStartedAt: null,
            lastError: null,
            messageId: message.messageId || null,
            smtpResponse:
              typeof message.response === "string"
                ? message.response.slice(0, 4000)
                : null,
          },
        }),

        prisma.emailDeliveryAttempt.update({
          where: {
            id: attempt.id,
          },
          data: {
            status: EmailDeliveryStatus.SENT,
            completedAt: new Date(),
            messageId: message.messageId || null,
            smtpResponse:
              typeof message.response === "string"
                ? message.response.slice(0, 4000)
                : null,
          },
        }),
      ]);

      result.sent += 1;
    } catch (error: unknown) {
      const message = errorMessage(error);
      const exhausted = attemptNumber >= email.maximumAttempts;

      const nextAttemptAt = exhausted
        ? null
        : new Date(Date.now() + retryDelayMinutes(attemptNumber) * 60 * 1000);

      await prisma.$transaction([
        prisma.emailDelivery.update({
          where: {
            id: email.id,
          },
          data: {
            status: exhausted
              ? EmailDeliveryStatus.FAILED
              : EmailDeliveryStatus.PENDING,
            attemptCount: attemptNumber,
            processingStartedAt: null,
            failedAt: exhausted ? new Date() : null,
            nextAttemptAt,
            lastError: message,
          },
        }),

        prisma.emailDeliveryAttempt.update({
          where: {
            id: attempt.id,
          },
          data: {
            status: EmailDeliveryStatus.FAILED,
            completedAt: new Date(),
            errorMessage: message,
          },
        }),
      ]);

      result.failed += 1;
    }
  }

  return result;
}

export async function recoverStuckEmailDeliveries() {
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);

  return prisma.emailDelivery.updateMany({
    where: {
      status: EmailDeliveryStatus.PROCESSING,
      processingStartedAt: {
        lt: staleThreshold,
      },
    },
    data: {
      status: EmailDeliveryStatus.PENDING,
      processingStartedAt: null,
      nextAttemptAt: new Date(),
      lastError: "Delivery processing timed out and was returned to the queue.",
    },
  });
}
