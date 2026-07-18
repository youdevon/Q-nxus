import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES,
  type EmployeeFileChecklistItemType,
} from "@/src/modules/hr/lib/employee-file-checklist";
import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string): string {
  const safe = fileName.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safe}"`;
}

function parseItemType(value: string): EmployeeFileChecklistItemType | null {
  return EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES.includes(
    value as EmployeeFileChecklistItemType,
  )
    ? (value as EmployeeFileChecklistItemType)
    : null;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
      itemType: string;
    }>;
  },
) {
  const { id, itemType: rawItemType } = await context.params;
  const itemType = parseItemType(rawItemType);
  const user = await getCurrentUser();

  if (!user?.isActive || !itemType) {
    return new Response("Not found", { status: 404 });
  }

  const capabilities = await getUserCapabilities();
  const item = await prisma.employeeFileChecklistItem.findFirst({
    where: {
      employeeId: id,
      itemType,
      organizationId: user.organizationId,
    },
  });

  if (!item?.storageKey || !item.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const canManage = capabilities?.can("people.manage");
  const isOwner =
    capabilities?.can("people.profile.view_own") &&
    user.employeeId === id &&
    item.employeeVisible;

  if (!canManage && !isOwner) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let absolutePath: string;
    try {
      absolutePath = resolveEmployeeFileAttachmentAbsolutePath(
        item.storageKey,
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await readFile(absolutePath);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": item.mimeType || "application/octet-stream",
        "Content-Length": String(item.fileSize ?? bytes.byteLength),
        "Content-Disposition": contentDisposition(item.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
