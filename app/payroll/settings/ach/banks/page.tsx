import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { AchBanksManager } from "@/src/modules/payroll/components/ach-banks-manager";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { getFinancialInstitutions } from "@/src/modules/payroll/data/get-financial-institutions";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "ACH banks",
};

export const dynamic = "force-dynamic";

export default async function AchBanksSettingsPage() {
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
    capabilities.can("payroll.ach.configure") ||
    capabilities.can("payroll.manage");

  const institutions = await getFinancialInstitutions();

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="ACH banks & routing"
        description="Trinidad & Tobago ACH participant directory for First Citizens salary file import. Add a bank here when it gains ACH support."
        backHref="/payroll/settings/ach"
        backLabel="ACH export settings"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/payroll/settings/institutions" />}
            >
              All institutions
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/payroll/settings/ach" />}
            >
              ACH format
            </Button>
          </div>
        }
      />
      <AchBanksManager institutions={institutions} canManage={canManage} />
    </PageShell>
  );
}
