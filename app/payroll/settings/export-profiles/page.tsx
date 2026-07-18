import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { prisma } from "@/lib/prisma";
import { BankExportProfileEditor } from "@/src/modules/payroll/components/bank-export-profile-editor";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Bank export profiles",
};

export const dynamic = "force-dynamic";

export default async function BankExportProfilesSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const canManage =
    capabilities.can("payroll.bank_export_profiles.manage") ||
    capabilities.can("payroll.manage");

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const profiles = organization
    ? await prisma.bankExportProfile.findMany({
        where: { organizationId: organization.id },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      })
    : [];

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="Bank export profiles"
        description="Adapter configuration for payment batches. Seeded GENERIC_CSV / MANUAL_REGISTER profiles are placeholders — do not treat column layouts as official bank ACH formats."
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

      <section>
        <SectionHeading>Profiles</SectionHeading>
        {profiles.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No profiles seeded yet. Run the platform seed to create
            MANUAL_REGISTER and GENERIC_CSV placeholders.
          </p>
        ) : (
          <div className="mt-2">
            {profiles.map((profile) => (
              <BankExportProfileEditor
                key={profile.id}
                canManage={canManage}
                profile={{
                  id: profile.id,
                  code: profile.code,
                  name: profile.name,
                  description: profile.description,
                  adapterKind: profile.adapterKind,
                  isDefault: profile.isDefault,
                  isPlaceholder: profile.isPlaceholder,
                  isActive: profile.isActive,
                  configurationJson: profile.configurationJson,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
