import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PayslipPrintView } from "@/src/modules/payroll/components/payslip-print-view";
import { getApprovedProjectedTaxYearPosition } from "@/src/modules/payroll/data/get-annual-paye-projections";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-stored-payslip";
import {
  getPayslipYtdBreakdown,
  getPreviewPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { prisma } from "@/lib/prisma";
import {
  payslipPeriodToAsOfDate,
  resolveDefaultLivePayslipPeriod,
} from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export const metadata: Metadata = {
  title: "Print payslip",
};

export const dynamic = "force-dynamic";

type MyPayslipPrintPageProps = {
  searchParams: Promise<{
    period?: string;
    preview?: string;
    payslipId?: string;
  }>;
};

export default async function MyPayslipPrintPage({
  searchParams,
}: MyPayslipPrintPageProps) {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const { period, preview, payslipId } = await searchParams;

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
      <PayslipPrintView
        payslip={posted.payslip}
        meta={posted.meta}
        ytd={posted.ytd}
        ytdBreakdown={posted.ytdBreakdown}
        projectedTaxYearPosition={posted.projectedTaxYearPosition}
        isOfficial
      />
    );
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
    resolveDefaultLivePayslipPeriod({ coverageStartDate });
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

  return (
    <PayslipPrintView
      payslip={payslip}
      meta={meta}
      ytd={ytd}
      ytdBreakdown={ytdBreakdown}
      projectedTaxYearPosition={projectedTaxYearPosition}
    />
  );
}
