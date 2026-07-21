import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import { EmployeeStatutoryOverridesPanel } from "@/src/modules/payroll/components/employee-statutory-overrides-panel";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { getEmployeeTaxYearPage } from "@/src/modules/payroll/data/get-employee-tax-year-page";
import { requirePayrollSetupAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export const metadata: Metadata = {
  title: "Employee tax year",
};

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  STANDARD_NON_CUMULATIVE: "Standard (non-cumulative)",
  STANDARD_CUMULATIVE: "Standard (cumulative)",
  PREVIOUS_INCOME_INCLUDED: "Previous income included",
  MANUAL_INSTRUCTION: "Manual instruction",
  SPECIAL_IRD_INSTRUCTION: "Special IRD instruction",
};

type TaxYearPageProps = {
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

function MetaBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export default async function EmployeeTaxYearPage({
  params,
  searchParams,
}: TaxYearPageProps) {
  const capabilities = await requirePayrollSetupAccess();
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const currentYear = taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const taxYear = parseYear(yearParam, currentYear);

  const data = await getEmployeeTaxYearPage(id, taxYear);

  if (!data) {
    notFound();
  }

  const setupHref = `/payroll/employees/${id}`;
  const canRequest =
    capabilities.can("payroll.setup") ||
    capabilities.can("payroll.manage") ||
    capabilities.can("payroll.statutory_override.request");
  const canDecide =
    capabilities.can("payroll.manage") ||
    capabilities.can("payroll.statutory_override.approve");

  const tax = data.taxProfile;
  const summary = data.taxProfileSummary;
  const prior = data.priorEmployment;
  const currency =
    data.postedPayslips[0]?.currency ??
    prior.records[0]?.currencyCode ??
    "TTD";

  const yearLinks = [taxYear - 1, taxYear, taxYear + 1].filter(
    (y) => y >= 2000 && y <= 2100,
  );

  const sourceLabel =
    summary.source === "tax_profile" ? "Tax profile" : "Defaults";

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title={`Tax year ${taxYear}`}
        description={`${data.employee.displayName} · ${data.employee.employeeNumber}`}
        backHref={setupHref}
        backLabel="Payroll setup"
        actions={
          <div className="flex flex-wrap gap-2">
            {yearLinks.map((y) => (
              <Button
                key={y}
                nativeButton={false}
                variant={y === taxYear ? "default" : "outline"}
                size="sm"
                render={
                  <Link href={`/payroll/employees/${id}/tax-year?year=${y}`} />
                }
              >
                {y}
              </Button>
            ))}
          </div>
        }
      />

      <div className="space-y-8">
        <section className="space-y-3">
          <div className="space-y-1">
            <SectionHeading>Tax profile</SectionHeading>
            <p className="text-sm text-muted-foreground">
              Summary for calendar tax year {taxYear}. Edit on payroll setup.
              {summary.source !== "tax_profile" ? (
                <>
                  {" "}
                  Showing {sourceLabel.toLowerCase()} until a dedicated tax
                  profile is saved.
                </>
              ) : null}
            </p>
          </div>
          {summary.source !== "none" || tax ? (
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetaBlock
                label="Source"
                value={sourceLabel}
              />
              <MetaBlock
                label="Method"
                value={
                  METHOD_LABELS[summary.taxCalculationMethod] ??
                  summary.taxCalculationMethod
                }
              />
              <MetaBlock
                label="TD1 submitted"
                value={tax?.td1Submitted ? "Yes" : "No"}
              />
              <MetaBlock
                label="Cumulative"
                value={
                  summary.cumulativeCalculationEnabled ? "Enabled" : "Off"
                }
              />
              <MetaBlock
                label="Status"
                value={
                  summary.taxProfileStatus?.replaceAll("_", " ") ?? "—"
                }
              />
              <MetaBlock
                label="Personal allowance"
                value={
                  summary.personalAllowanceOverride != null
                    ? formatMoney(summary.personalAllowanceOverride, {
                        currency,
                      })
                    : "Statutory default"
                }
              />
              <MetaBlock
                label="TD1 other approved"
                value={
                  summary.td1OtherApprovedAnnual > 0 ||
                  summary.source !== "none"
                    ? formatMoney(summary.td1OtherApprovedAnnual, {
                        currency,
                      })
                    : "—"
                }
              />
              <MetaBlock
                label="Previous employment"
                value={
                  summary.previousEmploymentDeclared
                    ? summary.previousEmploymentVerified
                      ? "Declared · verified"
                      : "Declared"
                    : "None declared"
                }
              />
              {tax?.effectiveFrom ? (
                <MetaBlock label="Effective from" value={tax.effectiveFrom} />
              ) : null}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              No tax profile or payroll TD1 for {taxYear}. Create one on{" "}
              <Link
                href={setupHref}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                payroll setup
              </Link>
              .
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <SectionHeading>Prior employment YTD</SectionHeading>
            <p className="text-sm text-muted-foreground">
              Mid-year joiner totals from previous employers this tax year.
            </p>
          </div>
          {prior.totals.recordCount > 0 ? (
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetaBlock
                label="Taxable income"
                value={formatMoney(prior.totals.taxableIncomeYtd, {
                  currency,
                })}
              />
              <MetaBlock
                label="PAYE deducted"
                value={formatMoney(prior.totals.payeDeductedYtd, {
                  currency,
                })}
              />
              <MetaBlock
                label="NIS (employee)"
                value={formatMoney(prior.totals.nisEmployeeYtd, { currency })}
              />
              <MetaBlock
                label="Health surcharge"
                value={formatMoney(prior.totals.healthSurchargeYtd, {
                  currency,
                })}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active prior-employment records for {taxYear}.
            </p>
          )}
          {prior.records.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Employer</th>
                    <th className="px-3 py-2 font-medium">As of</th>
                    <th className="px-3 py-2 font-medium">Taxable</th>
                    <th className="px-3 py-2 font-medium">PAYE</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prior.records.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{row.employerName}</p>
                        {row.employerBirNumber ? (
                          <p className="text-xs text-muted-foreground">
                            BIR {row.employerBirNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{row.asOfDate}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoney(Number(row.taxableIncomeYtd), {
                          currency: row.currencyCode,
                        })}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoney(Number(row.payeDeductedYtd), {
                          currency: row.currencyCode,
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={
                            row.status === "ACTIVE" ? "success" : "secondary"
                          }
                        >
                          {row.status}
                          {row.verified ? " · verified" : ""}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <SectionHeading>Posted payslips</SectionHeading>
            <p className="text-sm text-muted-foreground">
              Official slips in calendar year {taxYear}.
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Run</th>
                  <th className="px-3 py-2 font-medium text-right">Gross</th>
                  <th className="px-3 py-2 font-medium text-right">PAYE</th>
                  <th className="px-3 py-2 font-medium text-right">NIS</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.postedPayslips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No posted payslips in {taxYear}.
                    </td>
                  </tr>
                ) : (
                  data.postedPayslips.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{row.periodName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {row.periodKey}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{row.runNumber}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.grossPay, { currency: row.currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.paye, { currency: row.currency })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(row.nisEmployee, {
                          currency: row.currency,
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {formatMoney(row.netPay, { currency: row.currency })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <EmployeeStatutoryOverridesPanel
          employeeId={id}
          overrides={data.statutoryOverrides}
          canRequest={canRequest}
          canDecide={canDecide}
          currency={currency}
        />
      </div>
    </PageShell>
  );
}
