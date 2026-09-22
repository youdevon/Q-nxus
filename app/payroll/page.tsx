import type { Metadata } from "next";

import { PayrollReadinessDirectory } from "@/src/modules/payroll/components/payroll-readiness-directory";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { parsePayRunPayeeGroup } from "@/src/modules/payroll/lib/pay-run-payee-group";

export const metadata: Metadata = {
  title: "Payroll",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  payeeGroup?: string;
}>;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const payeeGroup = parsePayRunPayeeGroup(params.payeeGroup);

  const [capabilities, data] = await Promise.all([
    requirePayrollViewAccess(),
    getPayrollReadiness({
      ...(payeeGroup ? { workforceCategories: [payeeGroup] } : {}),
    }),
  ]);

  return (
    <PayrollReadinessDirectory
      data={data}
      payeeGroup={payeeGroup}
      canManage={capabilities.canAny("payroll.setup", "payroll.manage")}
    />
  );
}
