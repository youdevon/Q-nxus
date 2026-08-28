import Link from "next/link";
import { CircleAlert, CircleCheck, Printer, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import type { PayrollReadinessData } from "@/src/modules/payroll/lib/payroll-readiness-types";
import { PayrollNav } from "./payroll-nav";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function MetaField({
  label: fieldLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{fieldLabel}</p>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

export function PayrollReadinessDirectory({
  data,
  canManage,
}: {
  data: PayrollReadinessData;
  canManage: boolean;
}) {
  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Payroll"
        description="Payroll readiness for active employees. Blocking issues must be resolved before pay-run inclusion; warnings are shown but do not block payment."
        actions={
          data.readyCount > 0 ? (
            <PageActionsEnd>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link href="/payroll/print/ready" target="_blank" />
                }
              >
                <Printer />
                Print all ready payslips
              </Button>
            </PageActionsEnd>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="mt-1 text-2xl font-semibold">{data.rows.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Payroll ready</p>
          <p className="mt-1 text-2xl font-semibold">{data.readyCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Needs attention</p>
          <p className="mt-1 text-2xl font-semibold">{data.notReadyCount}</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <SectionHeading>Readiness directory</SectionHeading>
        </div>

        {data.rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No active employees found.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {data.rows.map((row) => {
              const setupHref = `/payroll/employees/${row.employeeId}`;
              const payslipHref = `${setupHref}/payslip?from=payroll`;

              return (
                <article key={row.employeeId} className="space-y-3 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-medium">{row.displayName}</p>
                      <Badge variant="outline">{row.employeeNumber}</Badge>
                      {row.workforceCategoryLabel ? (
                        <Badge variant="secondary">
                          {row.workforceCategoryLabel}
                        </Badge>
                      ) : null}
                      {row.isReady ? (
                        <Badge variant="success">
                          <CircleCheck />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <CircleAlert />
                          Not ready
                        </Badge>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <Link
                        href={payslipHref}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        View payslip
                      </Link>
                      {canManage ? (
                        <Link
                          href={setupHref}
                          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Setup
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:max-w-2xl">
                    <MetaField
                      label="Department"
                      value={row.departmentName ?? "Unassigned"}
                    />
                    <MetaField
                      label="Pay frequency"
                      value={
                        row.payFrequency ? label(row.payFrequency) : "Not set"
                      }
                    />
                    <MetaField
                      label="Payment method"
                      value={
                        row.paymentMethod ? label(row.paymentMethod) : "Not set"
                      }
                    />
                  </div>

                  {!row.isReady && row.blockingIssues.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.blockingIssues.map((issue) => (
                        <span
                          key={issue}
                          className="inline-flex max-w-full rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs leading-snug text-warning-foreground break-words dark:border-warning/40 dark:bg-warning/15 dark:text-warning"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {row.isReady && row.softWarnings.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.softWarnings.map((warning) => (
                        <span
                          key={warning}
                          className="inline-flex max-w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs leading-snug text-amber-950 break-words dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100"
                        >
                          {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {row.softWarnings.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.softWarnings.map((warning) => (
                        <span
                          key={warning}
                          className="inline-flex max-w-full rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs leading-snug text-muted-foreground break-words"
                        >
                          {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
