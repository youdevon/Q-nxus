import { prisma } from "@/lib/prisma"
import {
  getSmtpConfiguration,
  validateSmtpConfiguration,
} from "@/src/modules/notifications/services/smtp-config"

export async function getEmailAdministrationData() {
  const configuration = getSmtpConfiguration()
  const configurationErrors =
    validateSmtpConfiguration(configuration)

  const [
    pending,
    processing,
    sent,
    failed,
    cancelled,
    recent,
  ] = await Promise.all([
    prisma.emailDelivery.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.emailDelivery.count({
      where: {
        status: "PROCESSING",
      },
    }),
    prisma.emailDelivery.count({
      where: {
        status: "SENT",
      },
    }),
    prisma.emailDelivery.count({
      where: {
        status: "FAILED",
      },
    }),
    prisma.emailDelivery.count({
      where: {
        status: "CANCELLED",
      },
    }),
    prisma.emailDelivery.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
      select: {
        id: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        priority: true,
        status: true,
        attemptCount: true,
        maximumAttempts: true,
        sentAt: true,
        failedAt: true,
        lastError: true,
        createdAt: true,
      },
    }),
  ])

  return {
    smtp: {
      enabled: configuration.enabled,
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      usernameConfigured:
        configuration.username.length > 0,
      passwordConfigured:
        configuration.password.length > 0,
      fromName: configuration.fromName,
      fromEmail: configuration.fromEmail,
      replyTo: configuration.replyTo,
      configurationErrors,
    },
    totals: {
      pending,
      processing,
      sent,
      failed,
      cancelled,
    },
    recent: recent.map((delivery) => ({
      ...delivery,
      sentAt: delivery.sentAt?.toISOString() ?? null,
      failedAt:
        delivery.failedAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    })),
  }
}
