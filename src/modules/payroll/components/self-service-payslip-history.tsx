import Link from "next/link";
import { FileText, Printer, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import type { EmployeePayslipHistory } from "@/src/modules/payroll/data/get-pay-runs";

function runKindLabel(kind: "REGULAR" | "CORRECTION" | "OFF_CYCLE"): string {
  return kind === "CORRECTION"
    ? "Correction"
    : kind === "OFF_CYCLE"
      ? "Off-cycle"
      : "Regular";
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function SelfServicePayslipHistory({
  history,
}: {
  history: EmployeePayslipHistory;
}) {
  const { items, years, selectedYear } = history;

  return (
    <PageShell size="md">
      <MePageHeader
        title="Payslip history"
        description="Your posted payslips. Preview periods without a posted run are not shown here."
        backHref="/me"
        backLabel="My Profile"
      />

      {years.length > 0 ? (
        <section className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Show:</span>
          <FilterChip
            href="/me/payslips"
            label="Last 12 months"
            active={selectedYear == null}
          />
          {years.map((year) => (
            <FilterChip
              key={year}
              href={`/me/payslips?year=${year}`}
              label={String(year)}
              active={selectedYear === year}
            />
          ))}
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <SectionHeading>
            {selectedYear == null
              ? "Last 12 months"
              : `Posted in ${selectedYear}`}
          </SectionHeading>
        </div>

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No posted payslips
            {selectedYear == null ? " in the last 12 months" : ` for ${selectedYear}`}
            .
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_8rem_8rem_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.periodName}</p>
                    {item.runKind !== "REGULAR" ? (
                      <Badge variant="outline">
                        {runKindLabel(item.runKind)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.runNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-sm font-medium">{item.grossPay}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-sm font-medium">{item.netPay}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={<Link href={item.viewHref} />}
                  >
                    <FileText />
                    View
                  </Button>
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={<Link href={item.printHref} />}
                  >
                    <Printer />
                    Print
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
