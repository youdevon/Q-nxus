import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisEligibilityConfigForm } from "@/src/modules/payroll/components/nis-class-z-manager";
import { getNisEligibilityConfigForVersion } from "@/src/modules/payroll/data/get-nis-eligibility-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { DEFAULT_NIS_ELIGIBILITY } from "@/src/modules/payroll/lib/nis-eligibility";

export const metadata: Metadata = {
  title: "New NIS Eligibility Thresholds",
};

export const dynamic = "force-dynamic";

type NewEligibilityPageProps = {
  searchParams: Promise<{
    copyFrom?: string;
  }>;
};

export default async function NewEligibilityPage({
  searchParams,
}: NewEligibilityPageProps) {
  await requirePayrollManageAccess();

  const { copyFrom } = await searchParams;
  const source = copyFrom
    ? await getNisEligibilityConfigForVersion(copyFrom)
    : null;

  if (copyFrom && !source) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <NisEligibilityConfigForm
      config={{
        effectiveFrom: today,
        effectiveTo: null,
        versionLabel: source?.versionLabel ?? "2026",
        notes: source?.notes ?? null,
        isActive: true,
        fullRetirementAge:
          source?.fullRetirementAge ?? DEFAULT_NIS_ELIGIBILITY.fullRetirementAge,
        earlyRetirementAge:
          source?.earlyRetirementAge ?? DEFAULT_NIS_ELIGIBILITY.earlyRetirementAge,
      }}
      sourceEffectiveFrom={copyFrom ?? null}
      canManage
    />
  );
}
