"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDate } from "@/src/lib/format";
import type { EmployeeDirectoryItem } from "@/src/modules/hr/data/get-employees";
import { workforceCategoryBadgeLabel } from "@/src/modules/hr/lib/workforce-category";
import { EmployeeDirectoryRow } from "./employee-directory-row";

const SEARCH_DEBOUNCE_MS = 200;

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayNameFor(employee: EmployeeDirectoryItem): string {
  return [employee.preferredName ?? employee.firstName, employee.lastName].join(
    " ",
  );
}

type EmployeeDirectoryLiveSearchProps = {
  initialQuery?: string;
  showAllHref: string;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; employees: EmployeeDirectoryItem[] }
  | { status: "error"; query: string };

export function EmployeeDirectoryLiveSearch({
  initialQuery = "",
  showAllHref,
}: EmployeeDirectoryLiveSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState<SearchState>(() =>
    initialQuery.trim()
      ? { status: "loading", query: initialQuery.trim() }
      : { status: "idle" },
  );
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      requestIdRef.current += 1;
      const url = new URL(window.location.href);
      if (url.searchParams.has("query")) {
        url.searchParams.delete("query");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
      return;
    }

    const requestId = ++requestIdRef.current;
    const timeoutId = window.setTimeout(() => {
      setSearch({ status: "loading", query: trimmed });

      void (async () => {
        try {
          const response = await fetch(
            `/api/people/search?query=${encodeURIComponent(trimmed)}`,
            {
              method: "GET",
              credentials: "same-origin",
              cache: "no-store",
            },
          );

          if (requestId !== requestIdRef.current) {
            return;
          }

          if (!response.ok) {
            setSearch({ status: "error", query: trimmed });
            return;
          }

          const payload = (await response.json()) as {
            employees?: EmployeeDirectoryItem[];
          };
          setSearch({
            status: "ready",
            query: trimmed,
            employees: Array.isArray(payload.employees) ? payload.employees : [],
          });

          const url = new URL(window.location.href);
          url.searchParams.set("query", trimmed);
          url.searchParams.delete("page");
          window.history.replaceState(null, "", url.pathname + url.search);
        } catch {
          if (requestId === requestIdRef.current) {
            setSearch({ status: "error", query: trimmed });
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [trimmed]);

  const employees =
    trimmed && search.status === "ready" && search.query === trimmed
      ? search.employees
      : [];
  const isLoading =
    Boolean(trimmed) &&
    !(
      (search.status === "ready" || search.status === "error") &&
      search.query === trimmed
    );
  const showResults = trimmed.length > 0;
  const showEmpty =
    showResults &&
    !isLoading &&
    (search.status === "ready" || search.status === "error") &&
    search.query === trimmed &&
    employees.length === 0;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, number or email"
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Search people"
          autoComplete="off"
          autoFocus
        />
        {trimmed ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showResults ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Matching people
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {isLoading
                ? "Searching…"
                : `${employees.length} result${employees.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {showEmpty ? (
            <div className="py-12 text-center">
              <Users className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No people found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No matches for “{trimmed}”. Try another name, number, or email.
              </p>
            </div>
          ) : null}

          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm md:min-w-[900px]">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="hidden px-3 py-3 font-medium sm:table-cell">
                      Number
                    </th>
                    <th className="px-3 py-3 font-medium">Department</th>
                    <th className="hidden px-3 py-3 font-medium md:table-cell">
                      Position
                    </th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">
                      Type
                    </th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">
                      Hire date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((employee) => {
                    const displayName = displayNameFor(employee);
                    const href = `/people/employees/${employee.id}`;
                    const categoryBadge = workforceCategoryBadgeLabel(
                      employee.workforceCategory,
                    );

                    return (
                      <EmployeeDirectoryRow
                        key={employee.id}
                        href={href}
                        label={`View ${displayName}`}
                      >
                        <td className="px-3 py-4">
                          <span className="font-medium group-hover:underline">
                            {displayName}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {categoryBadge ? (
                              <Badge variant="secondary">{categoryBadge}</Badge>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {employee.workEmail ?? "No work email"}
                            </p>
                          </div>
                        </td>
                        <td className="hidden px-3 py-4 font-mono text-xs sm:table-cell">
                          {employee.employeeNumber}
                        </td>
                        <td className="px-3 py-4">
                          {employee.department?.name ?? "Unassigned"}
                        </td>
                        <td className="hidden px-3 py-4 md:table-cell">
                          {employee.position?.title ?? "Unassigned"}
                        </td>
                        <td className="hidden px-3 py-4 lg:table-cell">
                          {label(employee.employmentType)}
                        </td>
                        <td className="px-3 py-4">
                          <Badge
                            variant={employmentStatusBadgeVariant(
                              employee.employmentStatus,
                            )}
                          >
                            {label(employee.employmentStatus)}
                          </Badge>
                        </td>
                        <td className="hidden px-3 py-4 lg:table-cell">
                          {formatDisplayDate(employee.hireDate)}
                        </td>
                      </EmployeeDirectoryRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="py-14 text-center">
          <Search className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Find someone</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Start typing a name, number, or email — matches appear as you type.
            Click a row to open their profile.
          </p>
          <div className="mt-5">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={showAllHref} />}
            >
              <Users />
              Show all
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
