"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import {
  approveGratuitySettlement,
  markGratuityTaxRemitted,
  recalculateGratuitySettlement,
  scheduleGratuitySettlement,
  voidGratuitySettlement,
  type GratuitySettlementFormState,
} from "@/src/modules/payroll/actions/manage-gratuity-settlement";
import type {
  DraftPayRunForGratuity,
  GratuityBudgetForYear,
  GratuitySettlementListItem,
} from "@/src/modules/payroll/data/get-gratuity-settlements";
import { PayrollNav } from "./payroll-nav";

const idle: GratuitySettlementFormState = {
  status: "idle",
  message: "",
};

export type GratuityTab = "unpaid" | "paid" | "budget";

function SettlementActionForm({
  action,
  children,
  hidden,
  className,
}: {
  action: (
    prev: GratuitySettlementFormState,
    formData: FormData,
  ) => Promise<GratuitySettlementFormState>;
  children: React.ReactNode;
  hidden: Record<string, string>;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idle);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    } else if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className={className ?? "inline-flex"}>
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "success";
    case "APPROVED":
    case "SCHEDULED":
      return "default";
    case "CALCULATED":
      return "secondary";
    case "ESTIMATED":
    case "PENDING_ESTIMATE":
      return "warning";
    case "INELIGIBLE":
    case "VOID":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function money(value: string, currency = "TTD") {
  return formatMoney(value, { currency });
}

export function GratuityWorkspace({
  year,
  tab,
  unpaid,
  paid,
  budget,
  draftPayRuns,
  canManage,
}: {
  year: number;
  tab: GratuityTab;
  unpaid: GratuitySettlementListItem[];
  paid: GratuitySettlementListItem[];
  budget: GratuityBudgetForYear;
  draftPayRuns: DraftPayRunForGratuity[];
  canManage: boolean;
}) {
  const tabs: { id: GratuityTab; label: string; count?: number }[] = [
    { id: "unpaid", label: "Unpaid", count: unpaid.length },
    { id: "paid", label: "Paid", count: paid.length },
    { id: "budget", label: "Budget" },
  ];

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Gratuity"
        description="Estimate, approve, schedule, and remit tax for contract-end gratuity settlements."
        backHref="/payroll"
        backLabel="Payroll"
      />

      <form
        method="get"
        action="/payroll/gratuity"
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Year</span>
          <Input
            type="number"
            name="year"
            min={2000}
            max={2100}
            defaultValue={year}
            className="w-[8rem]"
            required
          />
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border/70 pb-px">
        {tabs.map((item) => {
          const active = tab === item.id;
          const href = `/payroll/gratuity?year=${year}&tab=${item.id}`;

          return (
            <Link
              key={item.id}
              href={href}
              className={[
                "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors",
                active
                  ? "border border-b-0 border-border/70 bg-background font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
              {item.count != null ? (
                <span className="text-xs text-muted-foreground">
                  ({item.count})
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {tab === "unpaid" ? (
        <UnpaidTable
          rows={unpaid}
          draftPayRuns={draftPayRuns}
          canManage={canManage}
        />
      ) : null}
      {tab === "paid" ? (
        <PaidTable rows={paid} canManage={canManage} />
      ) : null}
      {tab === "budget" ? <BudgetPanel budget={budget} /> : null}
    </PageShell>
  );
}

function UnpaidTable({
  rows,
  draftPayRuns,
  canManage,
}: {
  rows: GratuitySettlementListItem[];
  draftPayRuns: DraftPayRunForGratuity[];
  canManage: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Gift className="size-4 text-muted-foreground" />
        <SectionHeading>Unpaid settlements</SectionHeading>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Contract</th>
              <th className="px-3 py-2 font-medium">End date</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Gross</th>
              <th className="px-3 py-2 text-right font-medium">Tax</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
              {canManage ? (
                <th className="px-3 py-2 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 8 : 7}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No unpaid gratuity settlements for this year.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.contractId} className="border-b border-border/50">
                  <td className="px-3 py-3">
                    <Link
                      href={`/people/employees/${row.employeeId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.employeeName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeNumber}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/people/employees/${row.employeeId}/contracts/${row.contractId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.jobTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.contractEndDate
                      ? formatDisplayDate(row.contractEndDate)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {statusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.grossAmount, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.taxAmount, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.netAmount, row.currency)}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-3">
                      <UnpaidActions row={row} draftPayRuns={draftPayRuns} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnpaidActions({
  row,
  draftPayRuns,
}: {
  row: GratuitySettlementListItem;
  draftPayRuns: DraftPayRunForGratuity[];
}) {
  const canApprove =
    row.settlementId != null &&
    (row.status === "CALCULATED" || row.status === "ESTIMATED");
  const canSchedule =
    row.settlementId != null && row.status === "APPROVED";
  const canVoid =
    row.settlementId != null &&
    row.status !== "PAID" &&
    row.status !== "VOID" &&
    row.status !== "PENDING_ESTIMATE";

  return (
    <div className="flex min-w-[14rem] flex-col gap-2">
      <SettlementActionForm
        action={recalculateGratuitySettlement}
        hidden={{ contractId: row.contractId }}
      >
        <Button type="submit" size="sm" variant="outline">
          Recalculate
        </Button>
      </SettlementActionForm>

      {canApprove ? (
        <SettlementActionForm
          action={approveGratuitySettlement}
          hidden={{ settlementId: row.settlementId! }}
        >
          <Button type="submit" size="sm">
            Approve
          </Button>
        </SettlementActionForm>
      ) : null}

      {canSchedule ? (
        <SettlementActionForm
          action={scheduleGratuitySettlement}
          hidden={{ settlementId: row.settlementId! }}
          className="flex flex-col gap-1"
        >
          <select
            name="payRunId"
            required
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue=""
          >
            <option value="" disabled>
              Draft pay run…
            </option>
            {draftPayRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.runNumber} · {run.periodName} ({run.runKind})
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Schedule
          </Button>
        </SettlementActionForm>
      ) : null}

      {canVoid ? (
        <SettlementActionForm
          action={voidGratuitySettlement}
          hidden={{ settlementId: row.settlementId! }}
          className="flex flex-col gap-1"
        >
          <Input
            name="reason"
            placeholder="Void reason"
            required
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" variant="destructive">
            Void
          </Button>
        </SettlementActionForm>
      ) : null}
    </div>
  );
}

function PaidTable({
  rows,
  canManage,
}: {
  rows: GratuitySettlementListItem[];
  canManage: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Gift className="size-4 text-muted-foreground" />
        <SectionHeading>Paid settlements</SectionHeading>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Paid at</th>
              <th className="px-3 py-2 text-right font-medium">Gross</th>
              <th className="px-3 py-2 text-right font-medium">Tax</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
              <th className="px-3 py-2 font-medium">Pay run</th>
              <th className="px-3 py-2 font-medium">Remittance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No paid gratuity settlements for this year.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.settlementId ?? row.contractId}
                  className="border-b border-border/50"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/people/employees/${row.employeeId}/contracts/${row.contractId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.employeeName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeNumber}
                    </p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.paidAt
                      ? formatDisplayDate(row.paidAt.slice(0, 10))
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.grossAmount, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.taxAmount, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.netAmount, row.currency)}
                  </td>
                  <td className="px-3 py-3">
                    {row.payRunId ? (
                      <Link
                        href={`/payroll/runs/${row.payRunId}`}
                        className="underline-offset-2 hover:underline"
                      >
                        View run
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <Badge
                        variant={
                          row.taxRemittanceStatus === "REMITTED"
                            ? "success"
                            : row.taxRemittanceStatus === "PENDING"
                              ? "warning"
                              : "outline"
                        }
                      >
                        {statusLabel(row.taxRemittanceStatus ?? "N/A")}
                      </Badge>
                      {canManage &&
                      row.settlementId &&
                      row.taxRemittanceStatus === "PENDING" &&
                      Number(row.taxAmount) > 0 ? (
                        <SettlementActionForm
                          action={markGratuityTaxRemitted}
                          hidden={{ settlementId: row.settlementId }}
                          className="flex flex-col gap-1"
                        >
                          <Input
                            name="reference"
                            placeholder="Remittance ref"
                            required
                            className="h-8 text-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Mark remitted
                          </Button>
                        </SettlementActionForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BudgetPanel({ budget }: { budget: GratuityBudgetForYear }) {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Gift className="size-4 text-muted-foreground" />
          <SectionHeading>{budget.year} budget summary</SectionHeading>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Salary outlay</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.salaryBudget)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected gratuity (net)</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.expectedGratuityNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Committed</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.committedGratuityNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.paidGratuityNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unpaid (expected − paid)</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.unpaidGratuityNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contracts ending</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {budget.contractsEnding}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected gross / tax</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {money(budget.expectedGratuityGross)} /{" "}
              {money(budget.expectedGratuityTax)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading className="mb-4">Monthly breakdown</SectionHeading>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Salary</th>
                <th className="px-3 py-2 text-right font-medium">
                  Gratuity (net)
                </th>
              </tr>
            </thead>
            <tbody>
              {budget.byMonth.map((month) => (
                <tr key={month.month} className="border-b border-border/50">
                  <td className="px-3 py-2">{month.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(month.salaryOutlay)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(month.gratuityNet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading className="mb-4">Contracts ending this year</SectionHeading>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">End date</th>
                <th className="px-3 py-2 text-right font-medium">Months</th>
                <th className="px-3 py-2 text-right font-medium">Salary outlay</th>
                <th className="px-3 py-2 text-right font-medium">Gross</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {budget.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No gratuity-eligible contracts ending in {budget.year}.
                  </td>
                </tr>
              ) : (
                budget.rows.map((row) => (
                  <tr key={row.contractId} className="border-b border-border/50">
                    <td className="px-3 py-3">
                      <p className="font-medium">{row.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.employeeNumber} · {row.jobTitle}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.contractEndDate
                        ? formatDisplayDate(row.contractEndDate)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.monthsInYear}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {money(row.salaryOutlay)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {money(row.grossAmount)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {money(row.netAmount)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusBadgeVariant(row.settlementStatus)}>
                        {statusLabel(row.settlementStatus)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
