import {
  EmailPriority,
  Prisma,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export type QueueEmailInput = {
  notificationId?: string | null
  templateKey?: string | null
  moduleKey?: string | null
  relatedType?: string | null
  relatedId?: string | null
  recipientUserId?: string | null
  recipientEmail: string
  recipientName?: string | null
  subject: string
  textBody?: string | null
  htmlBody?: string | null
  priority?: EmailPriority
  maximumAttempts?: number
}

function maximumAttempts(): number {
  const parsed = Number(process.env.EMAIL_MAX_ATTEMPTS)

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : 3
}

export async function queueEmail(
  input: QueueEmailInput,
) {
  const recipientEmail =
    input.recipientEmail.trim().toLowerCase()

  if (!recipientEmail) {
    throw new Error("Recipient email is required.")
  }

  if (!input.subject.trim()) {
    throw new Error("Email subject is required.")
  }

  if (!input.textBody && !input.htmlBody) {
    throw new Error(
      "An email text body or HTML body is required.",
    )
  }

  return prisma.emailDelivery.create({
    data: {
      notificationId: input.notificationId ?? null,
      templateKey: input.templateKey ?? null,
      moduleKey: input.moduleKey ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      recipientUserId:
        input.recipientUserId ?? null,
      recipientEmail,
      recipientName:
        input.recipientName?.trim() || null,
      subject: input.subject.trim(),
      textBody: input.textBody ?? null,
      htmlBody: input.htmlBody ?? null,
      priority:
        input.priority ?? EmailPriority.NORMAL,
      maximumAttempts:
        input.maximumAttempts ?? maximumAttempts(),
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  })
}

export async function queueEmails(
  inputs: QueueEmailInput[],
) {
  const queued = []

  for (const input of inputs) {
    queued.push(await queueEmail(input))
  }

  return queued
}

export async function cancelQueuedEmail(
  emailDeliveryId: string,
) {
  return prisma.emailDelivery.updateMany({
    where: {
      id: emailDeliveryId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  })
}

export async function retryFailedEmail(
  emailDeliveryId: string,
) {
  return prisma.emailDelivery.updateMany({
    where: {
      id: emailDeliveryId,
      status: "FAILED",
    },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
      failedAt: null,
      lastError: null,
    },
  })
}

export function emailJson(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
