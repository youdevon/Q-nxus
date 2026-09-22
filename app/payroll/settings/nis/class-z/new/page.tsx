import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisClassZRateForm } from "@/src/modules/payroll/components/nis-class-z-manager";
import { getNisClassZRatesForVersion } from "@/src/modules/payroll/data/get-nis-class-z-rates";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  TT_NIS_CLASS_Z_2026_EFFECTIVE_FROM,
  TT_NIS_CLASS_Z_2026_RATES,
} from "@/src/modules/payroll/lib/nis-class-z-seed-data";

export const metadata: Metadata = {
  title: "New Class Z Rate Schedule",
};

export const dynamic = "force-dynamic";

type NewClassZSchedulePageProps = {
  searchParams: Promise<{
    copyFrom?: string;
  }>;
};

function defaultRatesFromSeed() {
  return TT_NIS_CLASS_Z_2026_RATES.map((row, index) => ({
    id: `seed-${index}`,
    monthlyMin: row.monthlyMin.toFixed(2),
    monthlyMax: row.monthlyMax?.toFixed(2) ?? null,
    employerWeeklyAmount: row.employerWeeklyAmount.toFixed(2),
    effectiveFrom: TT_NIS_CLASS_Z_2026_EFFECTIVE_FROM,
    effectiveTo: null,
    versionLabel: "2026",
    isActive: true,
    notes: null,
  }));
}

export default async function NewClassZSchedulePage({
  searchParams,
}: NewClassZSchedulePageProps) {
  await requirePayrollManageAccess();

  const { copyFrom } = await searchParams;
  const sourceRates = copyFrom
    ? await getNisClassZRatesForVersion(copyFrom)
    : [];

  const rates =
    sourceRates.length > 0 ? sourceRates : defaultRatesFromSeed();

  if (copyFrom && sourceRates.length === 0) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);
  const first = rates[0];

  return (
    <NisClassZRateForm
      rates={rates.map((row) => ({
        ...row,
        effectiveFrom: today,
        effectiveTo: null,
        versionLabel: row.versionLabel ?? null,
      }))}
      effectiveFrom={today}
      effectiveTo={null}
      versionLabel={first?.versionLabel ?? null}
      isActive
      sourceEffectiveFrom={copyFrom ?? null}
      canManage
    />
  );
}
