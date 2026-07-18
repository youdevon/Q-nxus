import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { FinancialInstitutionsManager } from "@/src/modules/payroll/components/financial-institutions-manager";
import { getFinancialInstitutions } from "@/src/modules/payroll/data/get-financial-institutions";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Financial Institutions",
};

export const dynamic = "force-dynamic";

export default async function FinancialInstitutionsSettingsPage() {
  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
    ))
  ) {
    notFound();
  }

  const capabilities = await requirePayrollViewAccess();
  const canManage =
    capabilities.can("payroll.financial_institutions.manage") ||
    capabilities.can("payroll.manage");

  const institutions = await getFinancialInstitutions();

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="Financial institutions"
        description="Trinidad & Tobago institution directory for employee bank selection. ACH codes are placeholders until confirmed."
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
      <FinancialInstitutionsManager
        institutions={institutions}
        canManage={canManage}
      />
    </PageShell>
  );
}
