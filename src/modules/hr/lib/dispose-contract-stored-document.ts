import { prisma } from "@/lib/prisma";
import { deleteEmployeeFileAttachment } from "@/src/modules/hr/lib/store-employee-file-attachment";

/**
 * Best-effort removal of a superseded contract document.
 * Respects legal hold (metadata retained; binary kept).
 */
export async function disposeContractStoredDocument(input: {
  storedFileId: string | null | undefined;
  storageKey: string | null | undefined;
}): Promise<void> {
  if (input.storedFileId) {
    const previous = await prisma.storedFile.findUnique({
      where: { id: input.storedFileId },
      select: { id: true, storageKey: true, legalHold: true },
    });

    if (!previous) {
      return;
    }

    if (previous.legalHold) {
      return;
    }

    await deleteEmployeeFileAttachment(previous.storageKey);
    await prisma.storedFile.delete({ where: { id: previous.id } });
    return;
  }

  if (input.storageKey) {
    await deleteEmployeeFileAttachment(input.storageKey);
  }
}
