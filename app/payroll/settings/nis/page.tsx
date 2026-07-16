import type { Metadata } from "next";

import { NisClassesDirectory } from "@/src/modules/payroll/components/nis-classes-manager";
import {
  getCurrentNisClasses,
  getNisClassVersions,
  getNisClassesForVersion,
} from "@/src/modules/payroll/data/get-nis-classes";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "NIS Earnings Classes",
};

export const dynamic = "force-dynamic";

type NisSettingsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function NisSettingsPage({
  searchParams,
}: NisSettingsPageProps) {
  const capabilities = await requirePayrollViewAccess();
  const canManage = capabilities.can("payroll.manage");
  const { version } = await searchParams;

  const versions = await getNisClassVersions();
  const selectedEffectiveFrom =
    version ??
    versions.find((entry) => entry.isCurrent)?.effectiveFrom ??
    versions[0]?.effectiveFrom ??
    null;

  const classes = selectedEffectiveFrom
    ? await getNisClassesForVersion(selectedEffectiveFrom)
    : await getCurrentNisClasses();

  return (
    <NisClassesDirectory
      versions={versions}
      classes={classes}
      selectedEffectiveFrom={selectedEffectiveFrom}
      canManage={canManage}
    />
  );
}
