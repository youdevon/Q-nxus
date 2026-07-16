import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { canAccessLeaveRequestAttachments } from "@/src/modules/hr/data/can-access-leave-attachments";
import { resolveLeaveAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-leave-attachment";

export const dynamic = "force-dynamic";

function contentDisposition(
  fileName: string,
  disposition: "inline" | "attachment",
): string {
  const safe = fileName.replace(/["\r\n]/g, "_");
  return `${disposition}; filename="${safe}"`;
}

function canInline(mimeType: string | null): boolean {
  if (!mimeType) {
    return false;
  }

  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/")
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      attachmentId: string;
    }>;
  },
) {
  const { id: leaveRequestId, attachmentId } = await context.params;

  const allowed = await canAccessLeaveRequestAttachments(leaveRequestId);

  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }

  const attachment = await prisma.leaveAttachment.findFirst({
    where: {
      id: attachmentId,
      leaveRequestId,
    },
    select: {
      fileName: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
    },
  });

  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  let absolutePath: string;

  try {
    absolutePath = resolveLeaveAttachmentAbsolutePath(attachment.storageKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  let bytes: Buffer;

  try {
    bytes = await readFile(absolutePath);
  } catch {
    return new Response("File missing", { status: 404 });
  }

  const url = new URL(request.url);
  const dispositionParam = url.searchParams.get("disposition");
  const disposition: "inline" | "attachment" =
    dispositionParam === "attachment" || !canInline(attachment.mimeType)
      ? "attachment"
      : "inline";

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(attachment.fileSize ?? bytes.byteLength),
      "Content-Disposition": contentDisposition(
        attachment.fileName,
        disposition,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
