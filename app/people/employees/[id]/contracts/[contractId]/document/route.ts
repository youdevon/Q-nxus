import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

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
      contractId: string;
    }>;
  },
) {
  const { id, contractId } = await context.params;
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId: id,
      employee: { organizationId: user.organizationId },
    },
    select: {
      id: true,
      documentStorageKey: true,
      documentFileName: true,
      documentMimeType: true,
      storedFileId: true,
    },
  });

  if (!contract?.documentStorageKey || !contract.documentFileName) {
    return new Response("Not found", { status: 404 });
  }

  const canManage =
    capabilities?.can("contracts.manage") ||
    capabilities?.can("people.manage");
  const isOwner =
    capabilities?.can("people.profile.view_own") && user.employeeId === id;

  if (!canManage && !isOwner) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let absolutePath: string;
    try {
      absolutePath = resolveEmployeeFileAttachmentAbsolutePath(
        contract.documentStorageKey,
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }

    const bytes = await readFile(absolutePath);
    const metadata = await getAuditRequestMetadata();

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        moduleKey: "hr",
        action: "DOWNLOAD",
        entityType: "EmploymentContract",
        entityId: contract.id,
        description: `Downloaded contract document ${contract.documentFileName}.`,
        newValues: {
          storageKey: contract.documentStorageKey,
          storedFileId: contract.storedFileId,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    return new Response(bytes, {
      headers: {
        "Content-Type":
          contract.documentMimeType ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(contract.documentFileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
