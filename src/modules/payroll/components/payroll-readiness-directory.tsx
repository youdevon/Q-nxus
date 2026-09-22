import Link from "next/link";
import { CircleAlert, CircleCheck, Printer, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { BOARD_MEMBER_UI } from "@/src/modules/hr/lib/workforce-category";
import {
  PAY_RUN_PAYEE_GROUP_OPTIONS,
  payRunPayeeGroupLabel,
  type PayRunPayeeGroupValue,
} from "@/src/modules/payroll/lib/pay-run-payee-group";
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

function PayeeGroupSwitcher({
  selected,
  groupCounts,
}: {
  selected: PayRunPayeeGroupValue | null;
  groupCounts: PayrollReadinessData["groupCounts"];
}) {
  const totalCount = groupCounts.reduce((sum, group) => sum + group.count, 0);
  const visibleGroups = PAY_RUN_PAYEE_GROUP_OPTIONS.filter((option) => {
    const count =
      groupCounts.find((group) => group.value === option.value)?.count ?? 0;
    // Always show Employees + Board; others only when present.
    return (
      option.value === "EMPLOYEE" ||
      option.value === "BOARD" ||
      count > 0
    );
  });

  const segments: Array<{
    value: PayRunPayeeGroupValue | null;
    label: string;
    count: number;
  }> = [
    { value: null, label: "All", count: totalCount },
    ...visibleGroups.map((option) => ({
      value: option.value,
      label: option.value === "EMPLOYEE" ? "Employees" : option.label,
      count:
        groupCounts.find((group) => group.value === option.value)?.count ?? 0,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by payee group"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1"
    >
      {segments.map((segment) => {
        const active = selected === segment.value;
        const href =
          segment.value == null
            ? "/payroll"
            : `/payroll?payeeGroup=${segment.value}`;
        const isBoard = segment.value === "BOARD";

        return (
          <Link
            key={segment.label}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? isBoard
                  ? cn(BOARD_MEMBER_UI.button, "shadow-none")
                  : "bg-background font-medium text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <span>{segment.label}</span>
            <span
              className={cn(
                "tabular-nums text-xs",
                active
                  ? isBoard
                    ? "text-white/80"
                    : "text-muted-foreground"
                  : "text-muted-foreground/80",
              )}
            >
              {segment.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function PayrollReadinessDirectory({
  data,
  payeeGroup = null,
  canManage,
}: {
  data: PayrollReadinessData;
  payeeGroup?: PayRunPayeeGroupValue | null;
  canManage: boolean;
}) {
  const groupLabel = payRunPayeeGroupLabel(payeeGroup);
  const printHref =
    payeeGroup == null
      ? "/payroll/print/ready"
      : `/payroll/print/ready?payeeGroup=${payeeGroup}`;
  const peopleNoun =
    payeeGroup === "BOARD"
      ? "board members"
      : payeeGroup
        ? groupLabel?.toLowerCase() ?? "people"
        : "people";

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Payroll"
        description="Payroll readiness for active payees. Filter by employees or board members — the same groups used for pay runs. Blocking issues must be fixed before inclusion; warnings do not block payment."
        icon={Wallet}
        actions={
          data.readyCount > 0 ? (
            <PageActionsEnd>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={printHref} target="_blank" />}
              >
                <Printer />
                Batch print · up to 3 per Letter
                {groupLabel ? ` · ${groupLabel}` : ""}
              </Button>
            </PageActionsEnd>
          ) : undefined
        }
      />

      <div className="mb-6">
        <PayeeGroupSwitcher
          selected={payeeGroup}
          groupCounts={data.groupCounts}
        />
      </div>

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {groupLabel ?? "People"}
          </p>
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
          <SectionHeading>
            {groupLabel ? `${groupLabel} readiness` : "Readiness directory"}
          </SectionHeading>
        </div>

        {data.rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No active {peopleNoun} found
            {payeeGroup ? " in this group" : ""}.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {data.rows.map((row) => {
              const setupHref = `/payroll/employees/${row.employeeId}`;
              const payslipHref = `${setupHref}/payslip?from=payroll`;
              const isBoard = row.workforceCategory === "BOARD";

              return (
                <article key={row.employeeId} className="space-y-3 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-medium">{row.displayName}</p>
                      {isBoard ? (
                        <Badge
                          variant="outline"
                          className={BOARD_MEMBER_UI.badge}
                        >
                          Board
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline">{row.employeeNumber}</Badge>
                          {row.workforceCategoryLabel ? (
                            <Badge variant="outline">
                              {row.workforceCategoryLabel}
                            </Badge>
                          ) : null}
                        </>
                      )}
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
                      label={isBoard ? "Role / body" : "Department"}
                      value={
                        isBoard
                          ? (row.departmentName ?? "Board")
                          : (row.departmentName ?? "Unassigned")
                      }
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
