import type { Metadata } from "next";

import { PayrollSalariesDirectory } from "@/src/modules/payroll/components/payroll-salaries-directory";
import { getPayrollSalaries } from "@/src/modules/payroll/data/get-payroll-salaries";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Salaries",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
}>;

export default async function PayrollSalariesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requirePayrollViewAccess();
  const params = await searchParams;
  const filters = {
    query: typeof params.query === "string" ? params.query : undefined,
  };
  const data = await getPayrollSalaries(filters);

  return (
    <PayrollSalariesDirectory
      data={data}
      filters={filters}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
