import type { Metadata } from "next";

import { PayRunsDirectory } from "@/src/modules/payroll/components/pay-runs-directory";
import { listPayRuns } from "@/src/modules/payroll/data/get-pay-runs";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Pay runs",
};

export const dynamic = "force-dynamic";

type PayrollRunsPageProps = {
  searchParams: Promise<{ deleted?: string | string[] }>;
};

export default async function PayrollRunsPage({
  searchParams,
}: PayrollRunsPageProps) {
  const capabilities = await requirePayrollViewAccess();
  const runs = await listPayRuns();
  const params = await searchParams;
  const deletedRaw = params.deleted;
  let deletedRunNumber: string | null = null;
  if (typeof deletedRaw === "string" && deletedRaw.trim().length > 0) {
    try {
      deletedRunNumber = decodeURIComponent(deletedRaw.trim());
    } catch {
      deletedRunNumber = deletedRaw.trim();
    }
  }

  return (
    <PayRunsDirectory
      runs={runs}
      canManage={capabilities.can("payroll.manage")}
      deletedRunNumber={deletedRunNumber}
    />
  );
}
