import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Search,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ListSearchFilters } from "@/src/components/list-search-filters";
import { PageShell } from "@/src/components/layout/page-shell";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDate } from "@/src/lib/format";
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
import { requireLeaveBalancesAccess } from "@/src/modules/hr/data/require-people-access";
import { CurrentContractLeaveEntitlementForm } from "@/src/modules/hr/components/current-contract-leave-entitlement-form";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";

export const metadata: Metadata = {
  title: "Leave Balances",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  employeeId?: string;
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

function EmployeeMatchList({
  matches,
  query,
}: {
  matches: LeaveBalanceEmployeeMatch[];
  query: string;
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
            href={`/people/leave/balances?employeeId=${employee.id}`}
            className="flex flex-col gap-1 px-3 py-4 hover:bg-muted/20 focus-visible:bg-muted/20 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{employee.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {employee.employeeNumber}
                {employee.workEmail ? ` · ${employee.workEmail}` : ""}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              {employee.departmentName ?? "No department"}
            </p>
          </Link>
        ))}
      </div>

      {matches.length >= LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the first {LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT}
          {" "}
          matches for “{query}”. Refine the search to narrow results.
        </p>
      ) : null}
    </section>
  );
}

function LeaveBalancesTable({
  employee,
  balances,
  entitlementEditor,
}: {
  employee: LeaveBalanceEmployeeMatch;
  balances: ContractLeaveBalanceRecord[];
  entitlementEditor: CurrentContractLeaveEntitlementData | null;
}) {
  const contractCount = new Set(
    balances.map((balance) => balance.contractId),
  ).size;

  const totalAvailable = balances.reduce(
    (total, balance) => total + Number(balance.availableBalance),
    0,
  );

  return (
    <>
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

          {contractCount > 0 ? (
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

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />

            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Current contract leave
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
              Generate balances from this employee’s current employment contract
              first. Amended contract versions are not listed here.
            </p>
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

                  return (
                    <tr
                      key={balance.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        isCurrentCycle && "bg-success/8",
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
    </>
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
  const canEditEntitlements = capabilities.canAny(
    "leave.manage",
    "people.manage",
    "contracts.manage",
  );

  let selectedEmployee: LeaveBalanceEmployeeMatch | null = null;
  let balances: ContractLeaveBalanceRecord[] = [];
  let matches: LeaveBalanceEmployeeMatch[] = [];
  let entitlementEditor: CurrentContractLeaveEntitlementData | null = null;

  if (employeeId) {
    selectedEmployee = await getLeaveBalanceEmployee(employeeId);

    if (selectedEmployee) {
      balances = await getContractLeaveBalances({
        employeeId: selectedEmployee.id,
      });

      if (canEditEntitlements) {
        entitlementEditor = await getCurrentContractLeaveEntitlementData(
          selectedEmployee.id,
        );
      }
    }
  } else if (query) {
    matches = await searchEmployeesForLeaveBalances(query);

    if (matches.length === 1) {
      selectedEmployee = matches[0];
      balances = await getContractLeaveBalances({
        employeeId: selectedEmployee.id,
      });
      matches = [];

      if (canEditEntitlements) {
        entitlementEditor = await getCurrentContractLeaveEntitlementData(
          selectedEmployee.id,
        );
      }
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
        description="Look up an employee to review leave entitlements and usage for their current employment contract. Adjust vacation or sick days for the active contract when needed. Amended or superseded contract versions are not listed."
      />

      <ListSearchFilters
        basePath="/people/leave/balances"
        clearHref="/people/leave/balances"
        searchPlaceholder="Name, employee number or email"
        searchValue={query}
        values={{ query }}
        fields={[]}
      />

      {showEmptyHint ? (
        <div className="py-16 text-center">
          <Search className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            Search an employee to view leave balances
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search by name, employee number, or email. Balances load only after
            an employee is selected.
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
        <EmployeeMatchList matches={matches} query={query} />
      ) : null}

      {selectedEmployee ? (
        <LeaveBalancesTable
          employee={selectedEmployee}
          balances={balances}
          entitlementEditor={entitlementEditor}
        />
      ) : null}
    </PageShell>
  );
}
