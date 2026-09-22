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

const STORAGE_PREFIX = "employee-file";

export function resolveEmployeeFileAttachmentAbsolutePath(
  storageKey: string,
): string {
  return resolveStoredFileAbsolutePath(storageKey, STORAGE_PREFIX);
}

export async function storeEmployeeFileAttachment({
  employee,
  recordType,
  recordId,
  file,
}: {
  employee: EmployeeStorageIdentity;
  recordType: "credentials" | "training" | "qualifications" | "checklist";
  recordId: string;
  file: File;
}): Promise<StoredFileMeta> {
  const fileName = safeStoredFileName(file.name || "attachment");
  const storageKey = path.posix.join(
    STORAGE_PREFIX,
    employeeStorageFolderLabel(employee),
    recordType,
    recordId,
    `${Date.now()}-${fileName}`,
  );

  return storeUploadedFile({
    storageKey,
    file,
    resolveAbsolutePath: resolveEmployeeFileAttachmentAbsolutePath,
  });
}

export async function readEmployeeFileAttachmentFile(
  storageKey: string,
): Promise<Buffer> {
  return readStoredFile(storageKey, resolveEmployeeFileAttachmentAbsolutePath);
}

/** Best-effort delete of a stored employee-file attachment. Missing files are ignored. */
export async function deleteEmployeeFileAttachment(
  storageKey: string,
): Promise<void> {
  return deleteStoredFile(
    storageKey,
    resolveEmployeeFileAttachmentAbsolutePath,
  );
}
