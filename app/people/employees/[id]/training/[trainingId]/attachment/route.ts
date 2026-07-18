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
      trainingId: string;
    }>;
  },
) {
  const { id, trainingId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  const training = await prisma.employeeTrainingRecord.findFirst({
    where: {
      id: trainingId,
      employeeId: id,
      organizationId: user.organizationId,
    },
  });

  if (!training?.storageKey || !training.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const canManage = capabilities?.can("people.manage");
  const isOwner =
    capabilities?.can("people.profile.view_own") &&
    user.employeeId === id &&
    training.employeeVisible;

  if (!canManage && !isOwner) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let absolutePath: string;
    try {
      absolutePath = resolveEmployeeFileAttachmentAbsolutePath(
        training.storageKey,
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await readFile(absolutePath);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": training.mimeType || "application/octet-stream",
        "Content-Length": String(training.fileSize ?? bytes.byteLength),
        "Content-Disposition": contentDisposition(training.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
