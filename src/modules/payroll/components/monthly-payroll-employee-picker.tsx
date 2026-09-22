"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UI_MOTION } from "@/src/config/ui-typography";
import type { EmployeeDirectoryItem } from "@/src/modules/hr/data/get-employees";

const SEARCH_DEBOUNCE_MS = 200;

export type MonthlyPayrollSelectedEmployee = {
  id: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; employees: EmployeeDirectoryItem[] }
  | { status: "error"; query: string };

function displayNameFor(employee: EmployeeDirectoryItem): string {
  return [employee.preferredName ?? employee.firstName, employee.lastName].join(
    " ",
  );
}

function toSelected(employee: EmployeeDirectoryItem): MonthlyPayrollSelectedEmployee {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    displayName: displayNameFor(employee),
    departmentName: employee.department?.name ?? null,
  };
}

/**
 * Live employee typeahead (same `/api/people/search` as People directory)
 * with multi-select chips for the monthly payroll report.
 */
export function MonthlyPayrollEmployeePicker({
  initialSelected = [],
}: {
  initialSelected?: MonthlyPayrollSelectedEmployee[];
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] =
    useState<MonthlyPayrollSelectedEmployee[]>(initialSelected);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const trimmed = query.trim();
  const selectedIds = new Set(selected.map((employee) => employee.id));

  useEffect(() => {
    if (!trimmed) {
      requestIdRef.current += 1;
      setSearch({ status: "idle" });
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
        } catch {
          if (requestId === requestIdRef.current) {
            setSearch({ status: "error", query: trimmed });
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [trimmed]);

  const matches =
    trimmed && search.status === "ready" && search.query === trimmed
      ? search.employees.filter((employee) => !selectedIds.has(employee.id))
      : [];
  const isLoading =
    Boolean(trimmed) &&
    !(
      (search.status === "ready" || search.status === "error") &&
      search.query === trimmed
    );

  function addEmployee(employee: EmployeeDirectoryItem) {
    setSelected((current) => {
      if (current.some((row) => row.id === employee.id)) {
        return current;
      }
      return [...current, toSelected(employee)];
    });
    setQuery("");
    setSearch({ status: "idle" });
    inputRef.current?.focus();
  }

  function removeEmployee(employeeId: string) {
    setSelected((current) => current.filter((row) => row.id !== employeeId));
  }

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      {selected.map((employee) => (
        <input
          key={employee.id}
          type="hidden"
          name="employeeIds"
          value={employee.id}
        />
      ))}

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Find employees</span>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, number or email"
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background py-1 pr-9 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Search employees to add"
            aria-controls={listId}
            aria-expanded={trimmed.length > 0}
            autoComplete="off"
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
      </label>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected employees">
          {selected.map((employee) => (
            <li key={employee.id}>
              <Badge
                variant="secondary"
                className="gap-1.5 py-1 pr-1 pl-2.5 text-sm font-normal"
              >
                <span className="min-w-0">
                  <span className="font-medium">{employee.displayName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {employee.employeeNumber}
                  </span>
                </span>
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground",
                    UI_MOTION.interactive,
                  )}
                  aria-label={`Remove ${employee.displayName}`}
                  onClick={() => removeEmployee(employee.id)}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Search and add one or more employees to include in the report.
        </p>
      )}

      {trimmed ? (
        <div
          id={listId}
          className="max-h-56 overflow-y-auto rounded-md border border-border/70 bg-background"
          role="listbox"
          aria-label="Matching employees"
        >
          {isLoading ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Searching…
            </p>
          ) : null}
          {!isLoading && search.status === "error" ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Search failed. Try again.
            </p>
          ) : null}
          {!isLoading && search.status === "ready" && matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No matches for “{trimmed}”.
            </p>
          ) : null}
          {matches.map((employee) => {
            const name = displayNameFor(employee);
            return (
              <button
                key={employee.id}
                type="button"
                role="option"
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60",
                  UI_MOTION.interactive,
                )}
                onClick={() => addEmployee(employee)}
              >
                <span className="min-w-0">
                  <span className="font-medium">{name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {employee.employeeNumber}
                    {employee.department?.name
                      ? ` · ${employee.department.name}`
                      : ""}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Plus className="size-3.5" />
                  Add
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
