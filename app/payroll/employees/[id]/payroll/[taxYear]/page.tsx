import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { getEmployeeMonthPayrollHistory } from "@/src/modules/payroll/data/get-employee-month-payroll-history";
import { requirePayrollEmployeeYearAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Employee payroll year",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; taxYear: string }>;
};

export default async function EmployeePayrollYearHistoryPage({
  params,
}: PageProps) {
  await requirePayrollEmployeeYearAccess();
  const { id, taxYear: taxYearRaw } = await params;
  const taxYear = Number(taxYearRaw);

  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    notFound();
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    notFound();
  }

  const history = await getEmployeeMonthPayrollHistory(id, taxYear);
  if (!history) {
    notFound();
  }

  const currency = history.rows[0]?.currency ?? "TTD";
  const displayName = `${employee.firstName} ${employee.lastName}`.trim();
  const setupHref = `/payroll/employees/${id}`;
  const taxYearHref = `/payroll/employees/${id}/tax-year?year=${taxYear}`;

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title={`Payroll history ${taxYear}`}
        description={`${displayName} · ${employee.employeeNumber}`}
        backHref={setupHref}
        backLabel="Payroll setup"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={taxYearHref} />}
            >
              Annual PAYE projection
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/payroll/employees/${id}/payroll/${taxYear - 1}`}
                />
              }
            >
              {taxYear - 1}
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/payroll/employees/${id}/payroll/${taxYear + 1}`}
                />
              }
            >
              {taxYear + 1}
            </Button>
          </div>
        }
      />

      <div className="space-y-8">
        <section className="space-y-3">
          <SectionHeading>Month-by-month</SectionHeading>
          <p className="text-sm text-muted-foreground">
            Values reconcile to payroll-result snapshots. Projected future
            earnings are not included here — see{" "}
            <Link
              href={taxYearHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              annual PAYE projection
            </Link>
            .
          </p>

          {history.rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              No payslips for {taxYear}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">Gross</th>
                    <th className="px-3 py-2 text-right font-medium">Taxable</th>
                    <th className="px-3 py-2 text-right font-medium">PAYE</th>
                    <th className="px-3 py-2 text-right font-medium">NIS emp</th>
                    <th className="px-3 py-2 text-right font-medium">HS</th>
                    <th className="px-3 py-2 text-right font-medium">Net</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map((row) => (
                    <tr key={row.payslipId} className="border-b align-top">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{row.periodName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.periodStart} → {row.periodEnd}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.grossPay, { currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.taxablePay, { currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.paye, { currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.nisEmployee, { currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.healthSurcharge, { currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {formatMoney(row.netPay, { currency })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{row.payslipStatus}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/payroll/runs/${row.payRunId}/payslips/${row.payslipId}`}
                          className="text-sm font-medium underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 font-medium">
                    <td className="px-3 py-2.5">Year-to-date total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.grossPay, { currency })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.taxablePay, { currency })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.paye, { currency })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.nisEmployee, {
                        currency,
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.healthSurcharge, {
                        currency,
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(history.yearTotals.netPay, { currency })}
                    </td>
                    <td className="px-3 py-2.5" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
