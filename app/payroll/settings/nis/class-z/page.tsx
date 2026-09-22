import type { Metadata } from "next";

import { NisClassZDirectory } from "@/src/modules/payroll/components/nis-class-z-manager";
import {
  getCurrentNisClassZRates,
  getNisClassZRateVersions,
  getNisClassZRatesForVersion,
} from "@/src/modules/payroll/data/get-nis-class-z-rates";
import {
  getNisEligibilityConfigVersions,
} from "@/src/modules/payroll/data/get-nis-eligibility-config";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "NIS Class Z",
};

export const dynamic = "force-dynamic";

type ClassZSettingsPageProps = {
  searchParams: Promise<{
    ratesVersion?: string;
    eligibilityVersion?: string;
  }>;
};

export default async function ClassZSettingsPage({
  searchParams,
}: ClassZSettingsPageProps) {
  const capabilities = await requirePayrollViewAccess();
  const canManage = capabilities.can("payroll.manage");
  const { ratesVersion, eligibilityVersion } = await searchParams;

  const [rateVersions, eligibilityVersions] = await Promise.all([
    getNisClassZRateVersions(),
    getNisEligibilityConfigVersions(),
  ]);

  const selectedRatesVersion =
    ratesVersion ??
    rateVersions.find((entry) => entry.isCurrent)?.effectiveFrom ??
    rateVersions[0]?.effectiveFrom ??
    null;

  const selectedEligibilityVersion =
    eligibilityVersion ??
    eligibilityVersions.find((entry) => entry.isCurrent)?.effectiveFrom ??
    eligibilityVersions[0]?.effectiveFrom ??
    null;

  const rates = selectedRatesVersion
    ? await getNisClassZRatesForVersion(selectedRatesVersion)
    : await getCurrentNisClassZRates();

  return (
    <NisClassZDirectory
      rateVersions={rateVersions}
      rates={rates}
      selectedRatesVersion={selectedRatesVersion}
      eligibilityVersions={eligibilityVersions}
      selectedEligibilityVersion={selectedEligibilityVersion}
      canManage={canManage}
    />
  );
}
