import type { Metadata } from "next";

import {
  StatutoryRemittanceReportPrintContent,
} from "@/src/modules/payroll/components/print/payroll-report-print-content";
import { getStatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print statutory remittance",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function StatutoryRemittanceReportPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requirePayrollViewAccess();
  const params = await searchParams;
  const data = await getStatutoryRemittanceReport({
    periodKey: typeof params.month === "string" ? params.month : undefined,
    actorUserId: capabilities.userId,
  });
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;

  return (
    <ReportPrintPage
      title="Statutory remittance"
      metaLines={[`Period: ${periodLabel}`]}
    >
      <StatutoryRemittanceReportPrintContent data={data} />
    </ReportPrintPage>
  );
}
