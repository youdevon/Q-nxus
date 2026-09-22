import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type RelatedNotificationRef = {
  relatedType: string;
  relatedId: string;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export function normalizeRelatedNotificationRefs(
  related: readonly RelatedNotificationRef[],
): RelatedNotificationRef[] {
  const seen = new Set<string>();
  const out: RelatedNotificationRef[] = [];
  for (const row of related) {
    const relatedType = row.relatedType.trim();
    const relatedId = row.relatedId.trim();
    if (!relatedType || !relatedId) {
      continue;
    }
    const key = `${relatedType}:${relatedId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ relatedType, relatedId });
  }
  return out;
}

/**
 * Remove in-app notifications (recipients cascade) and cancel pending emails
 * for the given related entities.
 */
export async function purgeNotificationsForRelatedEntities(
  client: DbClient,
  related: readonly RelatedNotificationRef[],
): Promise<{ notificationsDeleted: number; emailsCancelled: number }> {
  const refs = normalizeRelatedNotificationRefs(related);

  if (refs.length === 0) {
    return { notificationsDeleted: 0, emailsCancelled: 0 };
  }

  const orClause = refs.map((row) => ({
    relatedType: row.relatedType,
    relatedId: row.relatedId,
  }));

  const deleted = await client.notification.deleteMany({
    where: { OR: orClause },
  });

  const emails = await client.emailDelivery.updateMany({
    where: {
      OR: orClause,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  return {
    notificationsDeleted: deleted.count,
    emailsCancelled: emails.count,
  };
}

/**
 * Collect notification-related keys for a pay run about to be deleted.
 * Includes the run itself, its ACH batches, and payslip rows.
 */
export async function collectPayRunNotificationRefs(
  client: DbClient,
  payRunId: string,
): Promise<RelatedNotificationRef[]> {
  const [batches, payslips] = await Promise.all([
    client.achPaymentBatch.findMany({
      where: { payRunId },
      select: { id: true },
    }),
    client.payslip.findMany({
      where: { payRunId },
      select: { id: true },
    }),
  ]);

  return normalizeRelatedNotificationRefs([
    { relatedType: "PayRun", relatedId: payRunId },
    ...batches.map((batch) => ({
      relatedType: "AchPaymentBatch",
      relatedId: batch.id,
    })),
    ...payslips.map((slip) => ({
      relatedType: "Payslip",
      relatedId: slip.id,
    })),
  ]);
}
