import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteLeaveAttachmentFile } from "@/src/modules/hr/lib/store-leave-attachment";
import {
  purgeNotificationsForRelatedEntities,
  type RelatedNotificationRef,
} from "@/src/modules/notifications/services/purge-related-notifications";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Collect soft + Restrict dependents that must be cleared before an
 * EmploymentContract row can be hard-deleted.
 */
export async function collectEmploymentContractDeleteDependents(
  client: DbClient,
  contractIds: readonly string[],
): Promise<{
  notificationRefs: RelatedNotificationRef[];
  leaveAttachmentStorageKeys: string[];
  leaveRequestCount: number;
}> {
  const ids = [...new Set(contractIds.filter(Boolean))];
  if (ids.length === 0) {
    return {
      notificationRefs: [],
      leaveAttachmentStorageKeys: [],
      leaveRequestCount: 0,
    };
  }

  const leaveRequests = await client.leaveRequest.findMany({
    where: {
      contractId: { in: ids },
    },
    select: {
      id: true,
      attachments: {
        select: {
          storageKey: true,
        },
      },
    },
  });

  const notificationRefs: RelatedNotificationRef[] = [
    ...ids.map((relatedId) => ({
      relatedType: "EmploymentContract",
      relatedId,
    })),
    ...leaveRequests.map((request) => ({
      relatedType: "LeaveRequest",
      relatedId: request.id,
    })),
  ];

  const leaveAttachmentStorageKeys = leaveRequests.flatMap((request) =>
    request.attachments
      .map((attachment) => attachment.storageKey)
      .filter((key): key is string => Boolean(key)),
  );

  return {
    notificationRefs,
    leaveAttachmentStorageKeys,
    leaveRequestCount: leaveRequests.length,
  };
}

/**
 * Clears Restrict leave requests and related inbox/email soft links so the
 * contract row (and Prisma Cascade children) can be deleted cleanly.
 *
 * Cascade children handled by the DB on contract delete:
 * allowances, approval steps, leave balances, leave transactions,
 * gratuity settlements, gratuity accrual entries.
 * Successor contracts keep their row; sourceContractId is SetNull.
 */
export async function detachEmploymentContractRestrictDependents(
  client: DbClient,
  contractIds: readonly string[],
): Promise<{ leaveAttachmentStorageKeys: string[] }> {
  const dependents = await collectEmploymentContractDeleteDependents(
    client,
    contractIds,
  );

  await purgeNotificationsForRelatedEntities(
    client,
    dependents.notificationRefs,
  );

  if (dependents.leaveRequestCount > 0) {
    await client.leaveRequest.deleteMany({
      where: {
        contractId: { in: [...new Set(contractIds.filter(Boolean))] },
      },
    });
  }

  return {
    leaveAttachmentStorageKeys: dependents.leaveAttachmentStorageKeys,
  };
}

/** Best-effort disk cleanup for leave files whose DB rows were already removed. */
export async function disposeLeaveAttachmentFiles(
  storageKeys: readonly string[],
): Promise<void> {
  for (const storageKey of storageKeys) {
    try {
      await deleteLeaveAttachmentFile(storageKey);
    } catch (error) {
      console.error("Failed to clean up leave attachment file:", error);
    }
  }
}
