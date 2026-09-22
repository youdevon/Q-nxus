import type { Metadata } from "next";

import {
  EmployeeNisDetailPrintContent,
  nisDetailMetaLines,
} from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getEmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print employee NIS detail",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function EmployeeNisDetailPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requireReportAccess(
    findReportDefinition("employee-nis-detail")!,
  );
  const params = await searchParams;
  const data = await getEmployeeNisDetailReport({
    periodKey: params.month,
    actorUserId: capabilities.userId,
  });

  return (
    <ReportPrintPage
      title="Employee NIS detail"
      metaLines={nisDetailMetaLines(data)}
    >
      <EmployeeNisDetailPrintContent data={data} />
    </ReportPrintPage>
  );
}
