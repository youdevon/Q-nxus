import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Search,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageShell } from "@/src/components/layout/page-shell";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDate } from "@/src/lib/format";
import { LeaveBalancesSearch } from "@/src/modules/hr/components/leave-balances-search";
import { CurrentContractLeaveEntitlementForm } from "@/src/modules/hr/components/current-contract-leave-entitlement-form";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import {
  getContractLeaveBalances,
  getCurrentContractLeaveEntitlementData,
  getLeaveBalanceEmployee,
  LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT,
  searchEmployeesForLeaveBalances,
  type ContractLeaveBalanceRecord,
  type CurrentContractLeaveEntitlementData,
  type LeaveBalanceEmployeeMatch,
} from "@/src/modules/hr/data/get-contract-leave-balances";
import { getVacationForfeitureWarningForEmployee } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import { requireLeaveBalancesAccess } from "@/src/modules/hr/data/require-people-access";
import { buildLeaveBalancesUrl } from "@/src/modules/hr/lib/leave-balances-url";

export const metadata: Metadata = {
  title: "Leave Balances",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  employeeId?: string;
  focus?: string;
}>;

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

function formatQuantity(value: string): string {
  const number = Number(value);

  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

function LeaveSummaryChips({
  summary,
}: {
  summary: NonNullable<LeaveBalanceEmployeeMatch["leaveSummary"]>;
}) {
  if (summary.leaveTypeCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">No current-contract leave</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
      <span>
        VAC avail{" "}
        <span className="font-medium text-foreground">
          {formatQuantity(summary.vacationAvailable)}
        </span>
      </span>
      <span>
        SICK avail{" "}
        <span className="font-medium text-foreground">
          {formatQuantity(summary.sickAvailable)}
        </span>
      </span>
      <span>
        Taken{" "}
        <span className="font-medium text-foreground">
          {formatQuantity(summary.totalTaken)}
        </span>
      </span>
      <span>
        Reserved{" "}
        <span className="font-medium text-foreground">
          {formatQuantity(summary.totalApproved)}
        </span>
      </span>
    </div>
  );
}

function LeaveBreakdownPanel({
  balances,
  focusForfeiture,
}: {
  balances: ContractLeaveBalanceRecord[];
  focusForfeiture: boolean;
}) {
  if (balances.length === 0) {
    return null;
  }

  return (
    <section
      id="leave-breakdown"
      className="space-y-3 rounded-lg border border-border bg-muted/15 px-4 py-4"
    >
      <div>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Leave breakdown
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Entitlement, used (taken), approved/reserved, and remaining available
          on the current employment contract.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((balance) => {
          const highlight =
            focusForfeiture &&
            balance.leaveTypeCode === "VAC" &&
            Number(balance.availableBalance) > 0;

          return (
            <div
              key={balance.id}
              className={cn(
                "rounded-md border border-border/80 bg-background px-3 py-3",
                highlight && "border-amber-500/50 bg-amber-500/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{balance.leaveTypeName}</p>
                <Badge variant="outline">{balance.leaveTypeCode}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Entitlement</dt>
                  <dd className="font-medium tabular-nums">
                    {formatQuantity(balance.entitlement)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Taken</dt>
                  <dd className="font-medium tabular-nums">
                    {formatQuantity(balance.taken)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Approved / reserved
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatQuantity(balance.approved)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Available</dt>
                  <dd
                    className={cn(
                      "font-semibold tabular-nums",
                      highlight && "text-amber-800 dark:text-amber-300",
                    )}
                  >
                    {formatQuantity(balance.availableBalance)}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmployeeMatchList({
  matches,
  query,
  focusForfeiture,
}: {
  matches: LeaveBalanceEmployeeMatch[];
  query: string;
  focusForfeiture: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Matching employees
          </h2>
        </div>

        <span className="text-xs text-muted-foreground">
          {matches.length} result{matches.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="divide-y divide-border/70">
        {matches.map((employee) => (
          <Link
            key={employee.id}
            href={buildLeaveBalancesUrl({
              employeeId: employee.id,
              focus: focusForfeiture ? "forfeiture" : null,
            })}
            className="flex flex-col gap-2 px-3 py-4 hover:bg-muted/20 focus-visible:bg-muted/20 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{employee.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {employee.employeeNumber}
                {employee.workEmail ? ` · ${employee.workEmail}` : ""}
                {employee.departmentName
                  ? ` · ${employee.departmentName}`
                  : ""}
              </p>
              {employee.leaveSummary ? (
                <div className="mt-2">
                  <LeaveSummaryChips summary={employee.leaveSummary} />
                </div>
              ) : null}
            </div>

            <p className="text-sm font-medium text-primary">Open breakdown</p>
          </Link>
        ))}
      </div>

      {matches.length >= LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the first {LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT} matches for “
          {query}”. Refine the search to narrow results.
        </p>
      ) : null}
    </section>
  );
}

function LeaveBalancesDetail({
  employee,
  balances,
  entitlementEditor,
  forfeitureWarning,
  focusForfeiture,
}: {
  employee: LeaveBalanceEmployeeMatch;
  balances: ContractLeaveBalanceRecord[];
  entitlementEditor: CurrentContractLeaveEntitlementData | null;
  forfeitureWarning: Awaited<
    ReturnType<typeof getVacationForfeitureWarningForEmployee>
  >;
  focusForfeiture: boolean;
}) {
  const totalAvailable = balances.reduce(
    (total, balance) => total + Number(balance.availableBalance),
    0,
  );

  const showForfeitureBanner = Boolean(forfeitureWarning || focusForfeiture);

  return (
    <div className="space-y-8">
      {showForfeitureBanner ? (
        <section
          className={cn(
            "rounded-lg border px-4 py-3",
            forfeitureWarning?.isUrgent
              ? "border-destructive/40 bg-destructive/5"
              : "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                "mt-0.5 size-4 shrink-0",
                forfeitureWarning?.isUrgent
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-400",
              )}
            />
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                Vacation use-or-lose
                {focusForfeiture ? " — opened from alert" : ""}
              </p>
              {forfeitureWarning ? (
                <p className="text-muted-foreground">
                  {forfeitureWarning.message}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Review vacation available below and schedule leave so it
                  finishes on or before the contract end date. Vacation cannot
                  roll over.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={
                    <Link href="#leave-breakdown" />
                  }
                >
                  Jump to breakdown
                </Button>
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/people/leave/new?employeeId=${employee.id}`}
                    />
                  }
                >
                  Request leave for employee
                </Button>
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="ghost"
                  render={
                    <Link href={`/people/employees/${employee.id}`} />
                  }
                >
                  Employee profile
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserRound className="size-4" />
            Employee
          </div>

          <p className="mt-1 text-lg font-semibold">
            <Link
              href={`/people/employees/${employee.id}`}
              className="hover:underline"
            >
              {employee.name}
            </Link>
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {employee.employeeNumber}
            {employee.workEmail ? ` · ${employee.workEmail}` : ""}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarRange className="size-4" />
            Leave types
          </div>

          <p className="mt-1 text-2xl font-semibold">{balances.length}</p>

          {balances.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Current employment contract
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleDollarSign className="size-4" />
            Available leave
          </div>

          <p className="mt-1 text-2xl font-semibold">
            {formatQuantity(String(totalAvailable))}
          </p>
        </div>
      </section>

      <LeaveBreakdownPanel
        balances={balances}
        focusForfeiture={focusForfeiture}
      />

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />

            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Current contract leave detail
            </h2>
          </div>

          {balances.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Active cycle period highlighted
            </p>
          ) : null}
        </div>

        {balances.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">No leave balances found</p>

            <p className="mt-1 text-xs text-muted-foreground">
              There is no current employment contract with leave balances for
              this employee. If you followed an older alert, the contract may
              already have ended or been replaced.
            </p>
            <Button
              nativeButton={false}
              className="mt-4"
              variant="outline"
              render={<Link href={`/people/employees/${employee.id}`} />}
            >
              Open employee profile
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Contract period</th>
                  <th className="px-3 py-3 font-medium">Leave type</th>
                  <th className="px-3 py-3 text-right font-medium">
                    Entitlement
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Approved</th>
                  <th className="px-3 py-3 text-right font-medium">Taken</th>
                  <th className="px-3 py-3 text-right font-medium">
                    Available
                  </th>
                </tr>
              </thead>

              <tbody>
                {balances.map((balance) => {
                  const isCurrentCycle = balance.isCurrentCycle;
                  const isVacation = balance.leaveTypeCode === "VAC";
                  const highlightForfeiture =
                    focusForfeiture &&
                    isVacation &&
                    Number(balance.availableBalance) > 0;

                  return (
                    <tr
                      key={balance.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        isCurrentCycle && "bg-success/8",
                        highlightForfeiture && "bg-amber-500/10",
                      )}
                    >
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "font-medium",
                              isCurrentCycle && "text-success",
                            )}
                          >
                            {formatDate(balance.cycleStart)}
                            {" — "}
                            {formatDate(balance.cycleEnd)}
                          </p>

                          <Badge variant={activeStateBadgeVariant(true)}>
                            Current contract
                          </Badge>

                          {isCurrentCycle ? (
                            <Badge
                              variant="outline"
                              className="border-success/30 text-success"
                            >
                              Current period
                            </Badge>
                          ) : null}
                        </div>

                        {balance.contractNumber ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {balance.contractNumber}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <span>{balance.leaveTypeName}</span>

                          <Badge variant="outline">
                            {balance.leaveTypeCode}
                          </Badge>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-right tabular-nums">
                        {formatQuantity(balance.entitlement)}
                      </td>

                      <td className="px-3 py-4 text-right tabular-nums">
                        {formatQuantity(balance.approved)}
                      </td>

                      <td className="px-3 py-4 text-right tabular-nums">
                        {formatQuantity(balance.taken)}
                      </td>

                      <td
                        className={cn(
                          "px-3 py-4 text-right font-semibold tabular-nums",
                          isCurrentCycle && "text-success",
                          highlightForfeiture && "text-amber-800 dark:text-amber-300",
                        )}
                      >
                        {formatQuantity(balance.availableBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {entitlementEditor ? (
        <CurrentContractLeaveEntitlementForm contract={entitlementEditor} />
      ) : null}
    </div>
  );
}

export default async function LeaveBalancesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requireLeaveBalancesAccess();

  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const employeeId = params.employeeId?.trim() ?? "";
  const focusForfeiture = params.focus === "forfeiture";
  const canEditEntitlements = capabilities.canAny(
    "leave.manage",
    "people.manage",
    "contracts.manage",
  );

  let selectedEmployee: LeaveBalanceEmployeeMatch | null = null;
  let balances: ContractLeaveBalanceRecord[] = [];
  let matches: LeaveBalanceEmployeeMatch[] = [];
  let entitlementEditor: CurrentContractLeaveEntitlementData | null = null;
  let forfeitureWarning: Awaited<
    ReturnType<typeof getVacationForfeitureWarningForEmployee>
  > = null;

  if (employeeId) {
    selectedEmployee = await getLeaveBalanceEmployee(employeeId, {
      includeLeaveSummary: false,
    });

    if (selectedEmployee) {
      const [balanceRows, warning, editor] = await Promise.all([
        getContractLeaveBalances({
          employeeId: selectedEmployee.id,
        }),
        getVacationForfeitureWarningForEmployee(selectedEmployee.id),
        canEditEntitlements
          ? getCurrentContractLeaveEntitlementData(selectedEmployee.id)
          : Promise.resolve(null),
      ]);

      balances = balanceRows;
      forfeitureWarning = warning;
      entitlementEditor = editor;
    }
  } else if (query) {
    matches = await searchEmployeesForLeaveBalances(query);

    // Canonical deep link so notifications and search share one URL shape.
    if (matches.length === 1) {
      redirect(
        buildLeaveBalancesUrl({
          employeeId: matches[0].id,
          focus: focusForfeiture ? "forfeiture" : null,
        }),
      );
    }
  }

  const showEmptyHint = !employeeId && !query;
  const showNoEmployee = Boolean(employeeId) && selectedEmployee === null;
  const showNoMatches =
    Boolean(query) && !employeeId && matches.length === 0 && !selectedEmployee;

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Leave Balances"
        description="Search by name for entitlement, taken, and available leave. Vacation use-or-lose alerts open this same employee breakdown."
      />

      <LeaveBalancesSearch
        selectedEmployeeId={selectedEmployee?.id ?? null}
        selectedEmployeeName={selectedEmployee?.name ?? null}
        focusForfeiture={focusForfeiture}
        initialQuery={employeeId ? "" : query}
      />

      {showEmptyHint ? (
        <div className="py-16 text-center">
          <Search className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            Search an employee to view leave balances
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search by full or partial name, employee number, or email. Results
            show vacation/sick available and taken so you can pick the right
            person.
          </p>
        </div>
      ) : null}

      {showNoEmployee ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium">Employee not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The selected employee may have been archived or removed.
          </p>
        </div>
      ) : null}

      {showNoMatches ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium">No employees found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another name, employee number, or email.
          </p>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <EmployeeMatchList
          matches={matches}
          query={query}
          focusForfeiture={focusForfeiture}
        />
      ) : null}

      {selectedEmployee ? (
        <LeaveBalancesDetail
          employee={selectedEmployee}
          balances={balances}
          entitlementEditor={entitlementEditor}
          forfeitureWarning={forfeitureWarning}
          focusForfeiture={focusForfeiture}
        />
      ) : null}
    </PageShell>
  );
}
