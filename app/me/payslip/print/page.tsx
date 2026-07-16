import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PayslipPrintView } from "@/src/modules/payroll/components/payslip-print-view";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-pay-runs";
import { getPreviewPayslipYtd } from "@/src/modules/payroll/data/get-payslip-ytd";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import {
  getPreviousPayslipPeriod,
  payslipPeriodToAsOfDate,
} from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";

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
      posted.payslip.employee.id !== capabilities.employeeId
    ) {
      notFound();
    }

    return (
      <PayslipPrintView
        payslip={posted.payslip}
        meta={posted.meta}
        ytd={posted.ytd}
        isOfficial
      />
    );
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
    current: {
      grossPay: payslip.grossPay,
      totalDeductions: payslip.totalDeductions,
      netPay: payslip.netPay,
    },
  });

  return <PayslipPrintView payslip={payslip} meta={meta} ytd={ytd} />;
}
