import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisClassForm } from "@/src/modules/payroll/components/nis-classes-manager";
import { getNisClassesForVersion } from "@/src/modules/payroll/data/get-nis-classes";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { TT_NIS_2026_CLASSES } from "@/src/modules/payroll/lib/nis-seed-data";

export const metadata: Metadata = {
  title: "New NIS Class Schedule",
};

export const dynamic = "force-dynamic";

type NewNisSchedulePageProps = {
  searchParams: Promise<{
    copyFrom?: string;
  }>;
};

function defaultClassesFromSeed() {
  return TT_NIS_2026_CLASSES.map((row, index) => ({
    id: `seed-${index}`,
    classCode: row.classCode,
    monthlyMin: row.monthlyMin.toFixed(2),
    monthlyMax: row.monthlyMax?.toFixed(2) ?? null,
    employeeWeeklyAmount: row.employeeWeeklyAmount.toFixed(2),
    employerWeeklyAmount: row.employerWeeklyAmount.toFixed(2),
    effectiveFrom: "",
    effectiveTo: null,
    versionLabel: null,
    isActive: true,
  }));
}

export default async function NewNisSchedulePage({
  searchParams,
}: NewNisSchedulePageProps) {
  await requirePayrollManageAccess();

  const { copyFrom } = await searchParams;
  const sourceClasses = copyFrom
    ? await getNisClassesForVersion(copyFrom)
    : [];

  const classes =
    sourceClasses.length > 0 ? sourceClasses : defaultClassesFromSeed();

  if (copyFrom && sourceClasses.length === 0) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <NisClassForm
      classes={classes.map((row) => ({
        ...row,
        effectiveFrom: today,
        effectiveTo: null,
        versionLabel: row.versionLabel ?? null,
      }))}
      effectiveFrom={today}
      effectiveTo={null}
      versionLabel={null}
      isActive
      sourceEffectiveFrom={copyFrom ?? null}
      canManage
    />
  );
}
