"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildLeaveBalancesUrl } from "@/src/modules/hr/lib/leave-balances-url";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Leave-balances search that does not overwrite an employee deep link
 * (notification / queue) with a name query on mount.
 */
export function LeaveBalancesSearch({
  selectedEmployeeName = null,
  selectedEmployeeId = null,
  focusForfeiture = false,
  initialQuery = "",
}: {
  selectedEmployeeName?: string | null;
  selectedEmployeeId?: string | null;
  focusForfeiture?: boolean;
  initialQuery?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const viewingEmployee = Boolean(selectedEmployeeId && selectedEmployeeName);

  useEffect(() => {
    if (
      inputRef.current &&
      document.activeElement === inputRef.current
    ) {
      return;
    }
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // While an employee is pinned from a deep link, do not live-rewrite the URL
    // from the empty search box.
    if (viewingEmployee) {
      return;
    }

    if (query.trim() === initialQuery.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(
        buildLeaveBalancesUrl({
          query: query.trim() || null,
          focus: focusForfeiture ? "forfeiture" : null,
        }),
        { scroll: false },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query, initialQuery, viewingEmployee, focusForfeiture, router]);

  return (
    <section aria-label="Search leave balances" className="space-y-3 pb-1">
      {viewingEmployee ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Viewing</span>
          <Badge variant="outline" className="gap-1 pr-1">
            {selectedEmployeeName}
            <Link
              href="/people/leave/balances"
              className="inline-flex rounded-full p-0.5 hover:bg-muted"
              aria-label="Clear selected employee"
            >
              <X className="size-3" />
            </Link>
          </Badge>
          {focusForfeiture ? (
            <Badge variant="secondary">Vacation use-or-lose</Badge>
          ) : null}
        </div>
      ) : null}

      <form
        method="get"
        action="/people/leave/balances"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          router.replace(
            buildLeaveBalancesUrl({
              query: query.trim() || null,
              focus: focusForfeiture ? "forfeiture" : null,
            }),
          );
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            name="query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              viewingEmployee
                ? "Search another employee…"
                : "Name, employee number or email"
            }
            className="pl-8"
            aria-label="Search employees for leave balances"
            autoComplete="off"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit">
            <Search />
            Search
          </Button>
          {viewingEmployee || query.trim() || initialQuery ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/people/leave/balances" />}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
