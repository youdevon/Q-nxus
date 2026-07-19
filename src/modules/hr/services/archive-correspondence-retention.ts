import { prisma } from "@/lib/prisma";

export type ArchiveCorrespondenceRetentionResult = {
  archived: number;
};

/**
 * Archives issued correspondence whose retention date has passed.
 * Intended for scheduled execution via `npm run archive:correspondence-retention`.
 */
export async function archiveExpiredCorrespondenceRetention(
  asOf: Date = new Date(),
): Promise<ArchiveCorrespondenceRetentionResult> {
  const today = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );

  const result = await prisma.employeeCorrespondence.updateMany({
    where: {
      status: { in: ["ISSUED", "ACKNOWLEDGED"] },
      retentionUntil: {
        not: null,
        lt: today,
      },
    },
    data: {
      status: "ARCHIVED",
    },
  });

  return { archived: result.count };
}
