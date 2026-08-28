import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PayslipPreviewView } from "@/src/modules/payroll/components/payslip-preview";
import { getApprovedProjectedTaxYearPosition } from "@/src/modules/payroll/data/get-annual-paye-projections";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  getMostRecentPostedPayslip,
  getStoredPayslip,
} from "@/src/modules/payroll/data/get-stored-payslip";
import {
  getPayslipYtdBreakdown,
  getPreviewPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import {
  getPreviousPayslipPeriod,
  payslipPeriodToAsOfDate,
  resolveDefaultLivePayslipPeriod,
} from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "My Payslip",
};

export const dynamic = "force-dynamic";

type MyPayslipPageProps = {
  searchParams: Promise<{
    period?: string;
    preview?: string;
    payslipId?: string;
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

  const { period, preview, payslipId } = await searchParams;

  // A specific posted payslip from the employee's own history.
  if (payslipId && preview !== "1") {
    const posted = await getStoredPayslip(payslipId);

    if (
      !posted ||
      !posted.isPosted ||
      !posted.isReleased ||
      posted.payslip.employee.id !== capabilities.employeeId
    ) {
      notFound();
    }

    return (
      <PayslipPreviewView
        payslip={posted.payslip}
        meta={posted.meta}
        ytd={posted.ytd}
        ytdBreakdown={posted.ytdBreakdown}
        projectedTaxYearPosition={posted.projectedTaxYearPosition}
        backHref="/me/payslips"
        backLabel="Payslip history"
        printHref={`/me/payslip/print?payslipId=${posted.id}`}
        printLabel="Print payslip"
        title="Posted payslip"
        description={`${posted.periodName} · ${posted.runNumber} · posted`}
        isOfficial
      />
    );
  }

  const forcePreview = preview === "1" || Boolean(period);

  if (!forcePreview) {
    const posted = await getMostRecentPostedPayslip(capabilities.employeeId);

    if (posted) {
      return (
        <PayslipPreviewView
          payslip={posted.payslip}
          meta={posted.meta}
          ytd={posted.ytd}
          ytdBreakdown={posted.ytdBreakdown}
          projectedTaxYearPosition={posted.projectedTaxYearPosition}
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

  const coverage = await prisma.employee.findUnique({
    where: { id: capabilities.employeeId },
    select: {
      hireDate: true,
      contracts: {
        where: { isCurrent: true, status: "ACTIVE" },
        take: 1,
        select: { startDate: true },
      },
    },
  });
  const coverageStartCandidates = [
    coverage?.hireDate?.toISOString().slice(0, 10) ?? null,
    coverage?.contracts[0]?.startDate.toISOString().slice(0, 10) ?? null,
  ].filter((value): value is string => Boolean(value));
  const coverageStartDate =
    coverageStartCandidates.sort((a, b) => b.localeCompare(a))[0] ?? null;

  const periodKey =
    period?.trim() ||
    resolveDefaultLivePayslipPeriod({ coverageStartDate }) ||
    getPreviousPayslipPeriod();
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
  const ytdBreakdown = await getPayslipYtdBreakdown(
    capabilities.employeeId,
    ytd,
  );
  const projectedTaxYearPosition = await getApprovedProjectedTaxYearPosition(
    capabilities.employeeId,
    taxYearFromAsOfKey(toStatutoryAsOfKey(new Date(payslip.period.asOf))),
  );

  const printParams = new URLSearchParams();
  printParams.set("period", resolvedPeriodKey);
  printParams.set("preview", "1");
  const printHref = `/me/payslip/print?${printParams.toString()}`;

  return (
    <PayslipPreviewView
      payslip={payslip}
      meta={meta}
      ytd={ytd}
      ytdBreakdown={ytdBreakdown}
      projectedTaxYearPosition={projectedTaxYearPosition}
      backHref="/me"
      backLabel="My Profile"
      printHref={printHref}
      printLabel="Print preview"
      title="Payslip preview"
      isPreviewFallback
    />
  );
}
