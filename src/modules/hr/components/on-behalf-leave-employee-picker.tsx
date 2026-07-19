import Link from "next/link";
import { Search, UserRound } from "lucide-react";

import { ListSearchFilters } from "@/src/components/list-search-filters";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT,
  type LeaveBalanceEmployeeMatch,
} from "@/src/modules/hr/data/get-contract-leave-balances";

export function OnBehalfLeaveEmployeePicker({
  query,
  matches,
  showNoMatches,
}: {
  query: string;
  matches: LeaveBalanceEmployeeMatch[];
  showNoMatches: boolean;
}) {
  return (
    <PageShell>
      <PeoplePageHeader
        title="Request leave for an employee"
        description="Search and select the employee this leave request is for. This does not default to you."
        backHref="/people/leave"
        backLabel="Leave"
      />

      <ListSearchFilters
        basePath="/people/leave/new"
        clearHref="/people/leave/new"
        searchPlaceholder="Name, employee number or email"
        searchValue={query}
        values={{ query }}
        fields={[]}
      />

      {!query ? (
        <div className="py-12 text-center">
          <Search className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            Search an employee to request leave on their behalf
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use name, employee number, or email. The leave form opens only after
            you select someone.
          </p>
        </div>
      ) : null}

      {showNoMatches ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No employees matched “{query}”.
        </p>
      ) : null}

      {matches.length > 0 ? (
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
                href={`/people/leave/new?employeeId=${employee.id}`}
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
              Showing the first {LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT} matches for
              “{query}”. Refine the search to narrow results.
            </p>
          ) : null}
        </section>
      ) : null}
    </PageShell>
  );
}
