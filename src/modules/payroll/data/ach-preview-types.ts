import { formatMoney } from "@/src/lib/format";
import type { AchValidationSummary } from "@/src/modules/payroll/lib/ach/ach-validation";

/**
 * Shared ACH preview types/helpers safe for Client Components.
 * Keep Prisma out of this module.
 */

export type AchPreviewPageData = {
  payRunId: string;
  runNumber: string;
  status: string;
  periodName: string;
  paymentDate: string;
  currencyCode: string;
  settingsEnabled: boolean;
  forceLegacyTransactionCode: boolean;
  latestBatch: {
    id: string;
    batchNumber: string;
    status: string;
    fileName: string | null;
    bankValidationStatus: string | null;
    fcbErrorMessage: string | null;
    exportFormat: string | null;
    downloadHref: string | null;
  } | null;
  validation: AchValidationSummary;
};

export function formatAchPreviewTotal(
  amount: number,
  currencyCode: string,
): string {
  return formatMoney(amount, { currency: currencyCode });
}
