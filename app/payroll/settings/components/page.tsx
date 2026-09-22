import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { PayrollComponentsManager } from "@/src/modules/payroll/components/payroll-components-manager";
import { getPayrollComponentDefinitions } from "@/src/modules/payroll/data/get-payroll-recurring-components";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Recurring Components",
};

export const dynamic = "force-dynamic";

export default async function PayrollComponentsSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const canManage =
    capabilities.can("payroll.setup") || capabilities.can("payroll.manage");

  const definitions = await getPayrollComponentDefinitions(
    capabilities.userId,
  );

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="Recurring components"
        description="Loan, garnishment, pension installment, voluntary deduction, and recurring earning masters."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings" />}
          >
            Back to settings
          </Button>
        }
      />
      <PayrollComponentsManager
        definitions={definitions}
        canManage={canManage}
      />
    </PageShell>
  );
}
