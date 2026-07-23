import type { Metadata } from "next";

import {
  GratuityWorkspace,
  type GratuityTab,
} from "@/src/modules/payroll/components/gratuity-workspace";
import {
  getGratuityBudgetForYear,
  listDraftPayRunsForGratuity,
  listPaidGratuitySettlements,
  listUnpaidGratuitySettlements,
} from "@/src/modules/payroll/data/get-gratuity-settlements";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { listGratuityAccrualEntries } from "@/src/modules/payroll/services/gratuity-accruals";

export const metadata: Metadata = {
  title: "Gratuity",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  year?: string;
  tab?: string;
  rateOverride?: string;
  onlyCommitted?: string;
  excludePending?: string;
}>;

function parseYear(value: string | undefined): number {
  const current = new Date().getUTCFullYear();
  if (!value) {
    return current;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return current;
  }
  return parsed;
}

function parseTab(value: string | undefined): GratuityTab {
  if (
    value === "paid" ||
    value === "budget" ||
    value === "unpaid" ||
    value === "accruals"
  ) {
    return value;
  }
  return "unpaid";
}

function parseRateOverride(value: string | undefined): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function parseFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "on";
}

export default async function PayrollGratuityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requirePayrollViewAccess();
  const params = await searchParams;
  const year = parseYear(params.year);
  const tab = parseTab(params.tab);
  const canManage = capabilities.can("payroll.manage");
  const rateOverridePercent = parseRateOverride(params.rateOverride);
  const onlyCommitted = parseFlag(params.onlyCommitted);
  const excludePendingEstimates = parseFlag(params.excludePending);

  const [unpaid, paid, budget, accruals, draftPayRuns] = await Promise.all([
    listUnpaidGratuitySettlements({ year }),
    listPaidGratuitySettlements({ year }),
    getGratuityBudgetForYear(year, {
      rateOverridePercent,
      onlyCommitted,
      excludePendingEstimates,
    }),
    listGratuityAccrualEntries({ year }),
    listDraftPayRunsForGratuity(),
  ]);

  return (
    <GratuityWorkspace
      year={year}
      tab={tab}
      unpaid={unpaid}
      paid={paid}
      budget={budget}
      accruals={accruals}
      scenario={budget.scenario}
      draftPayRuns={draftPayRuns}
      canManage={canManage}
    />
  );
}
