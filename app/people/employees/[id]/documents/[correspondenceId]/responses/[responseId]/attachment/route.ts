import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { resolveCorrespondenceAttachmentAccess } from "@/src/modules/hr/data/can-access-correspondence-attachments";
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
      responseId: string;
    }>;
  },
) {
  const { correspondenceId, responseId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive || !user.organizationId) {
    return new Response("Not found", { status: 404 });
  }

  const access = await resolveCorrespondenceAttachmentAccess(correspondenceId);

  if (!access.allowed) {
    return new Response("Not found", { status: 404 });
  }

  const response = await prisma.employeeCorrespondenceResponse.findFirst({
    where: {
      id: responseId,
      correspondenceId,
      organizationId: user.organizationId,
    },
    select: {
      fileName: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
    },
  });

  if (!response?.storageKey || !response.fileName) {
    return new Response("Not found", { status: 404 });
  }

  let absolutePath: string;

  try {
    absolutePath = resolveCorrespondenceAttachmentAbsolutePath(
      response.storageKey,
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
    dispositionParam === "attachment" || !canInline(response.mimeType)
      ? "attachment"
      : "inline";

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": response.mimeType || "application/octet-stream",
      "Content-Length": String(response.fileSize ?? bytes.byteLength),
      "Content-Disposition": contentDisposition(
        response.fileName,
        disposition,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
