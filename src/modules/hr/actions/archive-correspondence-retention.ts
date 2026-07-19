"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { archiveExpiredCorrespondenceRetention } from "@/src/modules/hr/services/archive-correspondence-retention";

export type ArchiveRetentionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function archiveExpiredRetentionNow(
  _prev: ArchiveRetentionActionState,
  formData: FormData,
): Promise<ArchiveRetentionActionState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const result = await archiveExpiredCorrespondenceRetention();

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "EmployeeCorrespondence",
        entityId: "retention-archive",
        description: `Archived ${result.archived} correspondence record${result.archived === 1 ? "" : "s"} past retention.`,
        newValues: { archived: result.archived },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/documents");
    revalidatePath("/people/documents/missing");

    return {
      status: "success",
      message:
        result.archived === 0
          ? "No letters were past retention."
          : `Archived ${result.archived} letter${result.archived === 1 ? "" : "s"} past retention.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to archive expired retention letters.",
    };
  }
}
