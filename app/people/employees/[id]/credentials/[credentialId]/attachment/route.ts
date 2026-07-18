import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
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
      credentialId: string;
    }>;
  },
) {
  const { id, credentialId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  const credential = await prisma.employeeCredential.findFirst({
    where: {
      id: credentialId,
      employeeId: id,
      organizationId: user.organizationId,
    },
  });

  if (!credential?.storageKey || !credential.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const canManage = capabilities?.can("people.manage");
  const isOwner =
    capabilities?.can("people.profile.view_own") &&
    user.employeeId === id &&
    credential.employeeVisible;

  if (!canManage && !isOwner) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let absolutePath: string;
    try {
      absolutePath = resolveEmployeeFileAttachmentAbsolutePath(
        credential.storageKey,
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await readFile(absolutePath);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": credential.mimeType || "application/octet-stream",
        "Content-Length": String(credential.fileSize ?? bytes.byteLength),
        "Content-Disposition": contentDisposition(credential.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
