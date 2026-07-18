import path from "node:path";

import {
  deleteStoredFile,
  readStoredFile,
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
  storeUploadedFile,
  type StoredFileMeta,
} from "@/src/lib/stored-file";

const STORAGE_PREFIX = "leave";

export function resolveLeaveAttachmentAbsolutePath(storageKey: string): string {
  return resolveStoredFileAbsolutePath(storageKey, STORAGE_PREFIX);
}

export async function readLeaveAttachmentFile(
  storageKey: string,
): Promise<Buffer> {
  return readStoredFile(storageKey, resolveLeaveAttachmentAbsolutePath);
}

export async function storeLeaveAttachmentFile({
  leaveRequestId,
  file,
}: {
  leaveRequestId: string;
  file: File;
}): Promise<StoredFileMeta> {
  const fileName = safeStoredFileName(file.name || "attachment");
  const storageKey = path.posix.join(
    STORAGE_PREFIX,
    leaveRequestId,
    `${Date.now()}-${fileName}`,
  );

  return storeUploadedFile({
    storageKey,
    file,
    resolveAbsolutePath: resolveLeaveAttachmentAbsolutePath,
  });
}

/** Best-effort delete. Missing files are ignored. */
export async function deleteLeaveAttachmentFile(
  storageKey: string,
): Promise<void> {
  return deleteStoredFile(storageKey, resolveLeaveAttachmentAbsolutePath);
}

