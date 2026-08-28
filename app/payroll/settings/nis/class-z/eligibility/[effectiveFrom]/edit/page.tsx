import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisEligibilityConfigForm } from "@/src/modules/payroll/components/nis-class-z-manager";
import { getNisEligibilityConfigForVersion } from "@/src/modules/payroll/data/get-nis-eligibility-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit NIS Eligibility Thresholds",
};

export const dynamic = "force-dynamic";

type EditEligibilityPageProps = {
  params: Promise<{
    effectiveFrom: string;
  }>;
};

export default async function EditEligibilityPage({
  params,
}: EditEligibilityPageProps) {
  await requirePayrollManageAccess();

  const { effectiveFrom } = await params;
  const config = await getNisEligibilityConfigForVersion(
    decodeURIComponent(effectiveFrom),
  );

  if (!config) {
    notFound();
  }

  return (
    <NisEligibilityConfigForm
      config={{
        effectiveFrom: config.effectiveFrom,
        effectiveTo: config.effectiveTo,
        versionLabel: config.versionLabel,
        notes: config.notes,
        isActive: config.isActive,
        fullRetirementAge: config.fullRetirementAge,
        earlyRetirementAge: config.earlyRetirementAge,
      }}
      canManage
    />
  );
}
