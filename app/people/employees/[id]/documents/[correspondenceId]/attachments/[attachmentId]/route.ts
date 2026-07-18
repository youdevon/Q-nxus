import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import {
  resolveCorrespondenceAttachmentAccess,
  shouldAuditCorrespondenceAttachmentAccess,
} from "@/src/modules/hr/data/can-access-correspondence-attachments";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { resolveCorrespondenceAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-correspondence-attachment";

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

  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      correspondenceId: string;
      attachmentId: string;
    }>;
  },
) {
  const { correspondenceId, attachmentId } = await context.params;
  const sessionUser = await getCurrentUser();

  if (!sessionUser?.isActive || !sessionUser.organizationId) {
    return new Response("Not found", { status: 404 });
  }

  const access = await resolveCorrespondenceAttachmentAccess(correspondenceId);

  if (!access.allowed) {
    return new Response("Not found", { status: 404 });
  }

  const attachment = await prisma.employeeCorrespondenceAttachment.findFirst({
    where: {
      id: attachmentId,
      correspondenceId,
      correspondence: {
        organizationId: sessionUser.organizationId,
      },
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
    absolutePath = resolveCorrespondenceAttachmentAbsolutePath(
      attachment.storageKey,
    );
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

  if (
    access.correspondence &&
    shouldAuditCorrespondenceAttachmentAccess(access.correspondence.category)
  ) {
    const metadata = await getAuditRequestMetadata();

    try {
      await prisma.auditEvent.create({
        data: {
          userId: sessionUser.id,
          organizationId: sessionUser.organizationId,
          moduleKey: "hr",
          action: disposition === "attachment" ? "DOWNLOAD" : "VIEW",
          entityType: "EmployeeCorrespondenceAttachment",
          entityId: attachmentId,
          description: `${disposition === "attachment" ? "Downloaded" : "Viewed"} confidential attachment “${attachment.fileName}” (${access.correspondence.title})`,
          newValues: { correspondenceId },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    } catch (error) {
      console.error("Correspondence attachment audit failed:", error);
    }
  }

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
