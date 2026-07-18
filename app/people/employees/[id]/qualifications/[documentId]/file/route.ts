import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { canDownloadQualificationDocument } from "@/src/modules/hr/lib/qualification-access";
import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string): string {
  const safe = fileName.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
      documentId: string;
    }>;
  },
) {
  const { id, documentId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  const document = await prisma.employeeQualificationDocument.findFirst({
    where: {
      id: documentId,
      employeeId: id,
      organizationId: user.organizationId,
    },
  });

  if (!document?.storageKey || !document.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const allowed = canDownloadQualificationDocument({
    canManage: Boolean(capabilities?.can("people.manage")),
    canViewOwnProfile: Boolean(capabilities?.can("people.profile.view_own")),
    viewerEmployeeId: user.employeeId,
    documentEmployeeId: id,
    employeeVisible: document.employeeVisible,
  });

  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let absolutePath: string;
    try {
      absolutePath = resolveEmployeeFileAttachmentAbsolutePath(
        document.storageKey,
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await readFile(absolutePath);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": String(document.fileSize ?? bytes.byteLength),
        "Content-Disposition": contentDisposition(document.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
