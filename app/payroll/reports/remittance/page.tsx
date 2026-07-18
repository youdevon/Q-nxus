import type { Metadata } from "next";

import { StatutoryRemittanceReport } from "@/src/modules/payroll/components/statutory-remittance-report";
import { getStatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Statutory remittance",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  month?: string;
}>;

export default async function StatutoryRemittanceReportPage({
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

  return <StatutoryRemittanceReport data={data} />;
}
