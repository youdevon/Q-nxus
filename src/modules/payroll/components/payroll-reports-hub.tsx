import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Landmark,
} from "lucide-react";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { PayrollNav } from "./payroll-nav";

const reports = [
  {
    title: "Posted payroll",
    description:
      "Org totals and employee payment history from posted payslips — all employees, selected people, or a department over any month range. Includes corrections and off-cycle runs.",
    href: "/payroll/reports/monthly",
    icon: CalendarRange,
  },
  {
    title: "Year-end summaries",
    description:
      "Annual employee gross, PAYE, NIS, Health Surcharge, deductions, and net totals for TD4 / annual summary preparation.",
    href: "/payroll/reports/year-end",
    icon: CalendarDays,
  },
  {
    title: "Statutory remittance",
    description:
      "PAYE, NIS (employee + employer), and Health Surcharge due for a selected month — summed from posted payslips to prepare the statutory filing.",
    href: "/payroll/reports/remittance",
    icon: Landmark,
  },
] as const;

export function PayrollReportsHub() {
  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Payroll reports"
        description="Posted payroll analytics only. Draft runs and live payslip previews are never included in these totals."
        backHref="/reports"
        backLabel="Reports"
        icon={BarChart3}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SectionHeading icon={BarChart3}>Reports</SectionHeading>
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
