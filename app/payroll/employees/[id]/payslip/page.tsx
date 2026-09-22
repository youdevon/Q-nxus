import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPreviewView } from "@/src/modules/payroll/components/payslip-preview";
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
  const [{ id }, { from, period }, capabilities] = await Promise.all([
    params,
    searchParams,
    requirePayrollViewAccess(),
  ]);

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

  const fromPayroll = from === "payroll";
  const fromSalaries = from === "salaries";
  const canManage = capabilities.canAny("payroll.setup", "payroll.manage");
  const setupHref = `/payroll/employees/${payslip.employee.id}`;
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
  const printHref = `/payroll/employees/${id}/payslip/print${
    printParams.size > 0 ? `?${printParams.toString()}` : ""
  }`;

  return (
    <PayslipPreviewView
      payslip={payslip}
      meta={meta}
      ytd={ytd}
      ytdBreakdown={ytdBreakdown}
      projectedTaxYearPosition={projectedTaxYearPosition}
      backHref={backHref}
      backLabel={backLabel}
      setupHref={
        canManage && (fromPayroll || fromSalaries) ? setupHref : undefined
      }
      printHref={printHref}
    />
  );
}
