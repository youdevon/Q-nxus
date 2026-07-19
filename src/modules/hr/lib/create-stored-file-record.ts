import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { StoredFileMeta } from "@/src/lib/stored-file";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Persist StoredFile metadata for a file already written under uploads/.
 * Returns the StoredFile id.
 */
export async function createStoredFileRecord(
  input: {
    organizationId: string;
    meta: StoredFileMeta;
    uploadedByUserId: string | null;
    retentionUntil?: Date | null;
    legalHold?: boolean;
    checksumSha256?: string | null;
  },
  client: DbClient = prisma,
): Promise<string> {
  const row = await client.storedFile.create({
    data: {
      organizationId: input.organizationId,
      storageKey: input.meta.storageKey,
      fileName: input.meta.fileName,
      mimeType: input.meta.mimeType,
      fileSize: input.meta.fileSize,
      checksumSha256: input.checksumSha256 ?? null,
      uploadedByUserId: input.uploadedByUserId,
      retentionUntil: input.retentionUntil ?? null,
      legalHold: input.legalHold ?? false,
    },
    select: { id: true },
  });

  return row.id;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
