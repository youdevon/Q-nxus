import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayRunPaysheetPrintContent } from "@/src/modules/payroll/components/print/pay-run-paysheet-print-content";
import { getPayRunPaysheet } from "@/src/modules/payroll/data/get-pay-run-paysheet";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print payroll register",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayRunPaysheetPrintPage({ params }: PageProps) {
  const capabilities = await requirePayrollViewAccess();
  const { id } = await params;
  const data = await getPayRunPaysheet(id, {
    actorUserId: capabilities.userId,
  });

  if (!data) {
    notFound();
  }

  return (
    <ReportPrintPage
      title={`Payroll register — ${data.runNumber}`}
      wide
      metaLines={[
        `Period: ${data.periodName} (${data.periodStart} – ${data.periodEnd})`,
        `Status: ${data.statusLabel}${data.isPreview ? " · Preview" : ""}`,
        `Currency: ${data.currency} · ${data.includedCount} included`,
      ]}
      toolbarLabel={`Paysheet ${data.runNumber}`}
    >
      <PayRunPaysheetPrintContent data={data} />
    </ReportPrintPage>
  );
}
