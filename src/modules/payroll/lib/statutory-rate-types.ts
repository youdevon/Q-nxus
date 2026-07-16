/** Client-safe statutory rate DTOs (no Prisma / pg). */

export const STATUTORY_RATE_TYPE_LABELS: Record<string, string> = {
  PAYE: "PAYE (legacy flat % — prefer /payroll/settings/paye)",
};

export type StatutoryRateRecord = {
  id: string;
  rateType: "PAYE";
  ratePercent: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  isActive: boolean;
  isCurrent: boolean;
  updatedAt: string;
};
