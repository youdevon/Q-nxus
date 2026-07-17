import Link from "next/link";
import { BarChart3, CalendarDays, CalendarRange, UserRound } from "lucide-react";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { PayrollNav } from "./payroll-nav";

const reports = [
  {
    title: "Monthly payroll",
    description:
      "How much the organization paid for a selected month — gross, deductions, net, employer contributions, and total payroll cost from posted payslips.",
    href: "/payroll/reports/monthly",
    icon: CalendarRange,
  },
  {
    title: "Employee payment history",
    description:
      "How much was paid to a selected employee over a year, rolling months, or custom month range — including corrections and off-cycle runs.",
    href: "/payroll/reports/employee",
    icon: UserRound,
  },
  {
    title: "Year-end summaries",
    description:
      "Annual employee gross, PAYE, NIS, Health Surcharge, deductions, and net totals for TD4 / annual summary preparation.",
    href: "/payroll/reports/year-end",
    icon: CalendarDays,
  },
] as const;

export function PayrollReportsHub() {
  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Payroll reports"
        description="Posted payroll analytics only. Draft runs and live payslip previews are never included in these totals."
        backHref="/payroll"
        backLabel="Payroll"
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <SectionHeading>Reports</SectionHeading>
        </div>

        <div className="divide-y divide-border/70">
          {reports.map((report) => {
            const Icon = report.icon;

            return (
              <Link
                key={report.href}
                href={report.href}
                className="flex gap-4 py-5 transition-colors hover:bg-muted/30"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
