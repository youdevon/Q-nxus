import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { resolveStoredFileAbsolutePath } from "@/src/lib/stored-file";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

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
      recordId: string;
      documentId: string;
    }>;
  },
) {
  const { id, recordId, documentId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  if (
    !capabilities?.can("payroll.setup") &&
    !capabilities?.can("payroll.manage") &&
    !capabilities?.can("payroll.view")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const document = await prisma.employeePriorEmploymentDocument.findFirst({
    where: {
      id: documentId,
      organizationId: user.organizationId,
      priorEmploymentYtdId: recordId,
      priorEmploymentYtd: {
        employeeId: id,
      },
    },
    include: {
      storedFile: {
        select: {
          storageKey: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
        },
      },
    },
  });

  if (!document) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const absolutePath = resolveStoredFileAbsolutePath(
      document.storedFile.storageKey,
      "payroll",
    );
    const bytes = await readFile(absolutePath);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type":
          document.storedFile.mimeType || "application/octet-stream",
        "Content-Length": String(
          document.storedFile.fileSize ?? bytes.byteLength,
        ),
        "Content-Disposition": contentDisposition(document.storedFile.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
