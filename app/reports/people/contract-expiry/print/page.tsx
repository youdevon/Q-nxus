import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  ContractExpiryPrintContent,
  contractExpiryMetaLines,
} from "@/src/modules/reports/components/print/phase1-report-print-content";
import {
  getContractExpiryReport,
  parseContractExpiryWindow,
} from "@/src/modules/reports/data/get-contract-expiry-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print contract expiry list",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ window?: string }>;

export default async function ContractExpiryPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("contract-expiry")!);
  const params = await searchParams;

  if (typeof params.window !== "string") {
    redirect("/reports/people/contract-expiry/print?window=all");
  }

  const data = await getContractExpiryReport({
    window: parseContractExpiryWindow(params.window),
  });

  return (
    <ReportPrintPage
      title="Contract expiry list"
      metaLines={contractExpiryMetaLines(data)}
    >
      <ContractExpiryPrintContent data={data} />
    </ReportPrintPage>
  );
}
