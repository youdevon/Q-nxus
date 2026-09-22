import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ContractExpiryReportView } from "@/src/modules/reports/components/contract-expiry-report";
import {
  getContractExpiryReport,
  parseContractExpiryWindow,
} from "@/src/modules/reports/data/get-contract-expiry-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Contract expiry list",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ window?: string }>;

export default async function ContractExpiryReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("contract-expiry")!);
  const params = await searchParams;

  if (typeof params.window !== "string") {
    redirect("/reports/people/contract-expiry?window=all");
  }

  const window = parseContractExpiryWindow(params.window);
  const data = await getContractExpiryReport({ window });

  return <ContractExpiryReportView data={data} />;
}
