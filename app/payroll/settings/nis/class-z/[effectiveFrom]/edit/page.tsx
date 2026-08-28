import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisClassZRateForm } from "@/src/modules/payroll/components/nis-class-z-manager";
import { getNisClassZRatesForVersion } from "@/src/modules/payroll/data/get-nis-class-z-rates";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit Class Z Rate Schedule",
};

export const dynamic = "force-dynamic";

type EditClassZSchedulePageProps = {
  params: Promise<{
    effectiveFrom: string;
  }>;
};

export default async function EditClassZSchedulePage({
  params,
}: EditClassZSchedulePageProps) {
  await requirePayrollManageAccess();

  const { effectiveFrom } = await params;
  const rates = await getNisClassZRatesForVersion(
    decodeURIComponent(effectiveFrom),
  );

  if (rates.length === 0) {
    notFound();
  }

  const first = rates[0];

  return (
    <NisClassZRateForm
      rates={rates}
      effectiveFrom={first.effectiveFrom}
      effectiveTo={first.effectiveTo}
      versionLabel={first.versionLabel}
      isActive={first.isActive}
      canManage
    />
  );
}
