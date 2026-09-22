import { prisma } from "@/lib/prisma";

export type PurgeArchivedPriorEmploymentYtdResult = {
  deleted: number;
  retentionDays: number;
  cutoffIso: string;
};

const DEFAULT_RETENTION_DAYS = 365;

/**
 * Hard-deletes soft-archived prior-employment YTD rows older than the retention
 * window. Supporting documents cascade; StoredFile rows are left for the
 * stored-file retention job.
 */
export async function purgeArchivedPriorEmploymentYtd(
  options?: {
    asOf?: Date;
    retentionDays?: number;
  },
): Promise<PurgeArchivedPriorEmploymentYtdResult> {
  const asOf = options?.asOf ?? new Date();
  const retentionDays = Math.max(
    1,
    options?.retentionDays ?? DEFAULT_RETENTION_DAYS,
  );
  const cutoff = new Date(asOf.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

  const result = await prisma.employeePriorEmploymentYtd.deleteMany({
    where: {
      status: "ARCHIVED",
      updatedAt: { lt: cutoff },
    },
  });

  return {
    deleted: result.count,
    retentionDays,
    cutoffIso: cutoff.toISOString(),
  };
}
