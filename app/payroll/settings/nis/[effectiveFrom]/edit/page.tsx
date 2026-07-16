import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NisClassForm } from "@/src/modules/payroll/components/nis-classes-manager";
import { getNisClassesForVersion } from "@/src/modules/payroll/data/get-nis-classes";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit NIS Class Schedule",
};

export const dynamic = "force-dynamic";

type EditNisSchedulePageProps = {
  params: Promise<{
    effectiveFrom: string;
  }>;
};

export default async function EditNisSchedulePage({
  params,
}: EditNisSchedulePageProps) {
  await requirePayrollManageAccess();

  const { effectiveFrom } = await params;
  const classes = await getNisClassesForVersion(decodeURIComponent(effectiveFrom));

  if (classes.length === 0) {
    notFound();
  }

  const first = classes[0];

  return (
    <NisClassForm
      classes={classes}
      effectiveFrom={first.effectiveFrom}
      effectiveTo={first.effectiveTo}
      versionLabel={first.versionLabel}
      isActive={first.isActive}
      canManage
    />
  );
}
