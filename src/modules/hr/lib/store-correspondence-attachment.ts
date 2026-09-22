import path from "node:path";

import {
  deleteStoredFile,
  employeeStorageFolderLabel,
  readStoredFile,
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
  storeUploadedFile,
  type EmployeeStorageIdentity,
  type StoredFileMeta,
} from "@/src/lib/stored-file";

const STORAGE_PREFIX = "correspondence";

export function resolveCorrespondenceAttachmentAbsolutePath(
  storageKey: string,
): string {
  return resolveStoredFileAbsolutePath(storageKey, STORAGE_PREFIX);
}

export async function readCorrespondenceAttachmentFile(
  storageKey: string,
): Promise<Buffer> {
  return readStoredFile(storageKey, resolveCorrespondenceAttachmentAbsolutePath);
}

export async function storeCorrespondenceAttachmentFile({
  employee,
  correspondenceId,
  file,
}: {
  employee: EmployeeStorageIdentity;
  correspondenceId: string;
  file: File;
}): Promise<StoredFileMeta> {
  const fileName = safeStoredFileName(file.name || "attachment");
  const storageKey = path.posix.join(
    STORAGE_PREFIX,
    employeeStorageFolderLabel(employee),
    correspondenceId,
    `${Date.now()}-${fileName}`,
  );

  return storeUploadedFile({
    storageKey,
    file,
    resolveAbsolutePath: resolveCorrespondenceAttachmentAbsolutePath,
  });
}

/** Best-effort delete. Missing files are ignored. */
export async function deleteCorrespondenceAttachmentFile(
  storageKey: string,
): Promise<void> {
  return deleteStoredFile(
    storageKey,
    resolveCorrespondenceAttachmentAbsolutePath,
  );
}
