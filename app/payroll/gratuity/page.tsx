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

export const metadata: Metadata = {
  title: "Gratuity",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  year?: string;
  tab?: string;
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
  if (value === "paid" || value === "budget" || value === "unpaid") {
    return value;
  }
  return "unpaid";
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

  const [unpaid, paid, budget, draftPayRuns] = await Promise.all([
    listUnpaidGratuitySettlements({ year }),
    listPaidGratuitySettlements({ year }),
    getGratuityBudgetForYear(year),
    listDraftPayRunsForGratuity(),
  ]);

  return (
    <GratuityWorkspace
      year={year}
      tab={tab}
      unpaid={unpaid}
      paid={paid}
      budget={budget}
      draftPayRuns={draftPayRuns}
      canManage={canManage}
    />
  );
}
