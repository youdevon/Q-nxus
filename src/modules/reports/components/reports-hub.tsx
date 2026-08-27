import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import type { UserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  filterReportsForCapabilities,
  REPORT_CATEGORY_LABELS,
  type ReportCategoryId,
  type ReportDefinition,
} from "@/src/modules/reports/lib/report-definitions";

const CATEGORY_ORDER: ReportCategoryId[] = [
  "payroll",
  "people",
  "administration",
];

function groupReports(reports: ReportDefinition[]) {
  const grouped: Record<ReportCategoryId, ReportDefinition[]> = {
    payroll: [],
    people: [],
    administration: [],
  };

  for (const report of reports) {
    grouped[report.category].push(report);
  }

  return grouped;
}

export function ReportsHub({
  capabilities,
}: {
  capabilities: UserCapabilities;
}) {
  const accessible = filterReportsForCapabilities(capabilities);
  const grouped = groupReports(accessible);

  return (
    <PageShell size="lg">
      <PageHeader
        title="Reports"
        description="Operational reports across payroll, people, and administration. Posted payroll totals use frozen payslip snapshots only."
      />

      <section className="mb-8 rounded-lg border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
        <p>
          Route pattern: existing payroll analytics live under{" "}
          <code className="text-foreground">/payroll/reports/…</code>; new
          cross-module reports use{" "}
          <code className="text-foreground">/reports/payroll/…</code> and{" "}
          <code className="text-foreground">/reports/people/…</code>. Each report
          supports CSV and styled XLSX download; audit export is on the
          administration audit trail.
        </p>
      </section>

      {accessible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No reports are available for your role.
        </p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const reports = grouped[category];
          if (reports.length === 0) {
            return null;
          }

          return (
            <section key={category} className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="size-4 text-muted-foreground" />
                <SectionHeading>{REPORT_CATEGORY_LABELS[category]}</SectionHeading>
              </div>

              <div className="divide-y divide-border/70">
                {reports.map((report) => {
                  const Icon = report.icon;

                  return (
                    <Link
                      key={report.id}
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
          );
        })
      )}
    </PageShell>
  );
}
