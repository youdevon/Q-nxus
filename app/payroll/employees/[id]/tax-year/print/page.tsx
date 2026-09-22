import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnnualPayeProjectionPrintView } from "@/src/modules/payroll/components/annual-paye-projection-print-view";
import { getEmployeeTaxYearPage } from "@/src/modules/payroll/data/get-employee-tax-year-page";
import { requirePayrollEmployeeYearAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export const metadata: Metadata = {
  title: "Print annual PAYE projection",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
};

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fallback;
  }
  return year;
}

export default async function AnnualPayeProjectionPrintPage({
  params,
  searchParams,
}: PageProps) {
  await requirePayrollEmployeeYearAccess();
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const currentYear = taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const taxYear = parseYear(yearParam, currentYear);

  const data = await getEmployeeTaxYearPage(id, taxYear);
  if (!data?.annualProjection) {
    notFound();
  }

  const printedAt = new Date().toLocaleString("en-TT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AnnualPayeProjectionPrintView
      employee={data.employee}
      context={{
        taxYear,
        currency: data.projectionContext.currency,
        payFrequency: data.projectionContext.payFrequency,
        monthlyBasicSalary: data.projectionContext.monthlyBasicSalary,
        contractEndDate: data.projectionContext.contractEndDate,
        payeConfigVersionLabel: data.projectionContext.payeConfigVersionLabel,
        printedAt,
      }}
      projection={data.annualProjection}
      isMidYearJoiner={data.priorEmployment.totals.recordCount > 0}
    />
  );
}
