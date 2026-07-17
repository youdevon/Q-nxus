import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PayslipPreviewView } from "@/src/modules/payroll/components/payslip-preview";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getMostRecentPostedPayslip } from "@/src/modules/payroll/data/get-pay-runs";
import {
  getPreviewPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import {
  getPreviousPayslipPeriod,
  payslipPeriodToAsOfDate,
} from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";

export const metadata: Metadata = {
  title: "My Payslip",
};

export const dynamic = "force-dynamic";

type MyPayslipPageProps = {
  searchParams: Promise<{
    period?: string;
    preview?: string;
  }>;
};

export default async function MyPayslipPage({
  searchParams,
}: MyPayslipPageProps) {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const { period, preview } = await searchParams;
  const forcePreview = preview === "1" || Boolean(period);

  if (!forcePreview) {
    const posted = await getMostRecentPostedPayslip(capabilities.employeeId);

    if (posted) {
      return (
        <PayslipPreviewView
          payslip={posted.payslip}
          meta={posted.meta}
          ytd={posted.ytd}
          backHref="/me"
          backLabel="My Profile"
          printHref={`/me/payslip/print?payslipId=${posted.id}`}
          printLabel="Print payslip"
          title="Most recent payslip"
          description={`${posted.periodName} · ${posted.runNumber} · posted`}
          isOfficial
        />
      );
    }
  }

  const periodKey = period?.trim() || getPreviousPayslipPeriod();
  const asOf = payslipPeriodToAsOfDate(periodKey) ?? undefined;
  const result = await getEmployeePayslipPreview(capabilities.employeeId, {
    asOf,
  });

  if (!result) {
    notFound();
  }

  const { payslip, meta } = result;
  const resolvedPeriodKey =
    periodKeyFromAsOf(payslip.period.asOf) ?? periodKey;
  const ytd = await getPreviewPayslipYtd({
    employeeId: capabilities.employeeId,
    periodKey: resolvedPeriodKey,
    current: payslipPreviewToYtdContribution(payslip),
  });

  const printParams = new URLSearchParams();
  printParams.set("period", resolvedPeriodKey);
  printParams.set("preview", "1");
  const printHref = `/me/payslip/print?${printParams.toString()}`;

  return (
    <PayslipPreviewView
      payslip={payslip}
      meta={meta}
      ytd={ytd}
      backHref="/me"
      backLabel="My Profile"
      printHref={printHref}
      printLabel="Print preview"
      title="Payslip preview"
      isPreviewFallback
    />
  );
}
