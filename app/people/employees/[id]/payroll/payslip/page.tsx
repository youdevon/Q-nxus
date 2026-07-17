import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPreviewView } from "@/src/modules/payroll/components/payslip-preview";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getPreviewPayslipYtd } from "@/src/modules/payroll/data/get-payslip-ytd";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { payslipPeriodToAsOfDate } from "@/src/modules/payroll/lib/payslip-preview";
import { periodKeyFromAsOf } from "@/src/modules/payroll/lib/payslip-ytd";

export const metadata: Metadata = {
  title: "Payslip preview",
};

export const dynamic = "force-dynamic";

type EmployeePayslipPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string;
    period?: string;
  }>;
};

export default async function EmployeePayslipPage({
  params,
  searchParams,
}: EmployeePayslipPageProps) {
  const capabilities = await requirePayrollViewAccess();

  const { id } = await params;
  const { from, period } = await searchParams;
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

  const fromPayroll = from === "payroll";
  const fromSalaries = from === "salaries";
  const canManage = capabilities.canAny("payroll.setup", "payroll.manage");
  const setupHref = `/people/employees/${payslip.employee.id}/payroll`;
  const backHref = fromSalaries
    ? "/payroll/salaries"
    : fromPayroll
      ? "/payroll"
      : setupHref;
  const backLabel = fromSalaries
    ? "Salaries"
    : fromPayroll
      ? "Payroll"
      : "Payroll setup";

  const printParams = new URLSearchParams();
  if (period) {
    printParams.set("period", period);
  }
  const printHref = `/people/employees/${id}/payroll/payslip/print${
    printParams.size > 0 ? `?${printParams.toString()}` : ""
  }`;

  return (
    <PayslipPreviewView
      payslip={payslip}
      meta={meta}
      ytd={ytd}
      backHref={backHref}
      backLabel={backLabel}
      setupHref={
        canManage && (fromPayroll || fromSalaries) ? setupHref : undefined
      }
      printHref={printHref}
    />
  );
}
