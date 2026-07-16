import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPrintView } from "@/src/modules/payroll/components/payslip-print-view";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getPreviewPayslipYtd } from "@/src/modules/payroll/data/get-payslip-ytd";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { payslipPeriodToAsOfDate } from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";

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
  const resolvedPeriodKey = periodKeyFromAsOf(payslip.period.asOf);
  const ytd = resolvedPeriodKey
    ? await getPreviewPayslipYtd({
        employeeId: id,
        periodKey: resolvedPeriodKey,
        current: {
          grossPay: payslip.grossPay,
          totalDeductions: payslip.totalDeductions,
          netPay: payslip.netPay,
        },
      })
    : null;

  return <PayslipPrintView payslip={payslip} meta={meta} ytd={ytd} />;
}
