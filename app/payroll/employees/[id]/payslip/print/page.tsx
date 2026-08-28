import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPrintView } from "@/src/modules/payroll/components/payslip-print-view";
import { getApprovedProjectedTaxYearPosition } from "@/src/modules/payroll/data/get-annual-paye-projections";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  getPayslipYtdBreakdown,
  getPreviewPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { payslipPeriodToAsOfDate } from "@/src/modules/payroll/lib/payslip-preview";
import {
  assemblePayslipYtd,
  periodKeyFromAsOf,
  yearFromPeriodKey,
} from "@/src/modules/payroll/lib/payslip-ytd";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export const metadata: Metadata = {
  title: "Print payslip",
};

export const dynamic = "force-dynamic";

type EmployeePayslipPrintPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    period?: string;
  }>;
};

export default async function EmployeePayslipPrintPage({
  params,
  searchParams,
}: EmployeePayslipPrintPageProps) {
  await requirePayrollViewAccess();

  const { id } = await params;
  const { period } = await searchParams;
  const result = await getEmployeePayslipPreview(id, {
    asOf: payslipPeriodToAsOfDate(period) ?? undefined,
  });

  if (!result) {
    notFound();
  }

  const { payslip, meta } = result;
  const resolvedPeriodKey =
    periodKeyFromAsOf(payslip.period.asOf) ?? period?.trim() ?? null;
  const current = payslipPreviewToYtdContribution(payslip);
  const ytd = resolvedPeriodKey
    ? await getPreviewPayslipYtd({
        employeeId: id,
        periodKey: resolvedPeriodKey,
        current,
      })
    : assemblePayslipYtd({
        year:
          yearFromPeriodKey(period?.trim()) ??
          taxYearFromAsOfKey(toStatutoryAsOfKey(new Date(payslip.period.asOf))),
        priorPosted: [],
        current,
      });
  const ytdBreakdown = await getPayslipYtdBreakdown(id, ytd);
  const projectedTaxYearPosition = await getApprovedProjectedTaxYearPosition(
    id,
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
