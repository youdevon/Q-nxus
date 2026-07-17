import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SelfServicePayslipHistory } from "@/src/modules/payroll/components/self-service-payslip-history";
import { getEmployeePostedPayslipHistory } from "@/src/modules/payroll/data/get-pay-runs";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Payslip history",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function MyPayslipHistoryPage({ searchParams }: PageProps) {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("people.profile.view_own") || !capabilities.employeeId) {
    redirect("/");
  }

  const { year } = await searchParams;
  const parsedYear = Number(year);
  const requestedYear =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : null;

  const history = await getEmployeePostedPayslipHistory(
    capabilities.employeeId,
    { year: requestedYear },
  );

  return <SelfServicePayslipHistory history={history} />;
}
