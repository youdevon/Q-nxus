import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function resolveLeaveAttachmentAbsolutePath(storageKey: string): string {
  const normalized = path.posix.normalize(storageKey);

  if (
    !normalized.startsWith("leave/") ||
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

export async function readLeaveAttachmentFile(
  storageKey: string,
): Promise<Buffer> {
  const absolutePath = resolveLeaveAttachmentAbsolutePath(storageKey);
  return readFile(absolutePath);
}

export async function storeLeaveAttachmentFile({
  leaveRequestId,
  file,
}: {
  leaveRequestId: string;
  file: File;
}): Promise<{
  fileName: string;
  storageKey: string;
  mimeType: string | null;
  fileSize: number;
}> {
  if (file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 5 MB or smaller.");
  }

  const mimeType = file.type || null;

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Attachments must be PDF, Word, or image files.");
  }

  const fileName = safeFileName(file.name || "attachment");
  const storageKey = path.posix.join(
    "leave",
    leaveRequestId,
    `${Date.now()}-${fileName}`,
  );
  const absolutePath = resolveLeaveAttachmentAbsolutePath(storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    fileName,
    storageKey,
    mimeType,
    fileSize: file.size,
  };
}
