import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { AchSettingsForm } from "@/src/modules/payroll/components/ach-settings-form";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { getAchSettingsPageData } from "@/src/modules/payroll/data/get-ach-settings";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "ACH export settings",
};

export const dynamic = "force-dynamic";

export default async function AchSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    throw new Error("Organization is required.");
  }

  const data = await getAchSettingsPageData(organizationId);
  const canManage =
    capabilities.can("payroll.ach.configure") ||
    capabilities.can("payroll.manage");

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="ACH export settings"
        description="First Citizens TT legacy NACHA no-header salary file configuration. Uncertain bank rules stay configurable — never silently assumed."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/payroll/settings/ach/banks" />}
            >
              ACH banks & routing
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/payroll/settings" />}
            >
              Back to settings
            </Button>
          </div>
        }
      />
      <AchSettingsForm
        settings={data.settings}
        nextTraceSequence={data.nextTraceSequence}
        canManage={canManage}
      />
    </PageShell>
  );
}
