import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Shared metadata shape for on-disk attachments (leave, credentials, etc.). */
export type StoredFileMeta = {
  fileName: string;
  storageKey: string;
  mimeType: string | null;
  fileSize: number;
};

export const DEFAULT_STORED_FILE_MAX_BYTES = 5 * 1024 * 1024;

export const DEFAULT_STORED_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export function safeStoredFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Resolve a relative storage key under uploads/, rejecting traversal and absolute paths.
 * `prefix` is the first path segment (e.g. "leave" or "employee-file").
 */
export function resolveStoredFileAbsolutePath(
  storageKey: string,
  prefix: string,
): string {
  const normalized = path.posix.normalize(storageKey);

  if (
    !normalized.startsWith(`${prefix}/`) ||
    normalized.includes("\0") ||
    path.isAbsolute(normalized)
  ) {
    throw new Error("Invalid attachment storage key.");
  }

  const absolutePath = path.resolve(UPLOADS_ROOT, normalized);
  const rootWithSep = `${UPLOADS_ROOT}${path.sep}`;

  if (absolutePath !== UPLOADS_ROOT && !absolutePath.startsWith(rootWithSep)) {
    throw new Error("Invalid attachment storage key.");
  }

  return absolutePath;
}

export async function storeUploadedFile(input: {
  storageKey: string;
  file: File;
  resolveAbsolutePath: (storageKey: string) => string;
  maxBytes?: number;
  allowedMimeTypes?: Set<string>;
}): Promise<StoredFileMeta> {
  const maxBytes = input.maxBytes ?? DEFAULT_STORED_FILE_MAX_BYTES;
  const allowedMimeTypes =
    input.allowedMimeTypes ?? DEFAULT_STORED_FILE_MIME_TYPES;

  if (input.file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (input.file.size > maxBytes) {
    throw new Error("Attachments must be 5 MB or smaller.");
  }

  const mimeType = input.file.type || null;

  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new Error("Attachments must be PDF, Word, or image files.");
  }

  if (!mimeType) {
    throw new Error("Attachments must include a recognized file type.");
  }

  const fileName = safeStoredFileName(input.file.name || "attachment");
  const absolutePath = input.resolveAbsolutePath(input.storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await input.file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    fileName,
    storageKey: input.storageKey,
    mimeType,
    fileSize: input.file.size,
  };
}

export async function readStoredFile(
  storageKey: string,
  resolveAbsolutePath: (storageKey: string) => string,
): Promise<Buffer> {
  return readFile(resolveAbsolutePath(storageKey));
}

/** Best-effort delete. Missing files are ignored. */
export async function deleteStoredFile(
  storageKey: string,
  resolveAbsolutePath: (storageKey: string) => string,
): Promise<void> {
  const absolutePath = resolveAbsolutePath(storageKey);

  try {
    await unlink(absolutePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}
