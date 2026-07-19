import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/src/lib/stored-file";
import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";

/**
 * Archive stored files past retention when not on legal hold.
 * Does not delete binaries that still have legalHold=true.
 */
export async function archiveExpiredStoredFileRetention(input?: {
  organizationId?: string;
  now?: Date;
}): Promise<{ archived: number; skippedHold: number }> {
  const now = input?.now ?? new Date();

  const candidates = await prisma.storedFile.findMany({
    where: {
      archivedAt: null,
      retentionUntil: { lte: now },
      ...(input?.organizationId
        ? { organizationId: input.organizationId }
        : {}),
    },
    select: {
      id: true,
      storageKey: true,
      legalHold: true,
    },
    take: 500,
  });

  let archived = 0;
  let skippedHold = 0;

  for (const file of candidates) {
    if (file.legalHold) {
      skippedHold += 1;
      continue;
    }

    await prisma.storedFile.update({
      where: { id: file.id },
      data: { archivedAt: now },
    });
    archived += 1;
  }

  return { archived, skippedHold };
}

export async function setStoredFileLegalHold(input: {
  storedFileId: string;
  legalHold: boolean;
}) {
  return prisma.storedFile.update({
    where: { id: input.storedFileId },
    data: { legalHold: input.legalHold },
    select: { id: true, legalHold: true },
  });
}

/**
 * Purge archived stored-file binaries that are not on legal hold.
 * Soft-archives first via archiveExpiredStoredFileRetention.
 */
export async function purgeArchivedStoredFileBinaries(input?: {
  organizationId?: string;
  olderThanDays?: number;
}): Promise<{ purged: number }> {
  const olderThanDays = input?.olderThanDays ?? 30;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);

  const rows = await prisma.storedFile.findMany({
    where: {
      legalHold: false,
      archivedAt: { lte: cutoff },
      ...(input?.organizationId
        ? { organizationId: input.organizationId }
        : {}),
    },
    select: { id: true, storageKey: true },
    take: 200,
  });

  let purged = 0;

  for (const row of rows) {
    try {
      await deleteStoredFile(row.storageKey, (key) =>
        resolveEmployeeFileAttachmentAbsolutePath(key),
      );
    } catch {
      // Binary may already be gone; still clear retention marker.
    }

    await prisma.storedFile.update({
      where: { id: row.id },
      data: {
        // Keep metadata for audit; mark purged via retentionUntil null + archived
        retentionUntil: null,
      },
    });
    purged += 1;
  }

  return { purged };
}
