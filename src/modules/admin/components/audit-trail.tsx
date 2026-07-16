import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  Search,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/src/components/layout/page-header"
import { AdministrationNav } from "./administration-nav"
import type {
  AuditFilters,
  AuditTrailData,
} from "@/src/modules/admin/data/get-audit-events"

type AuditTrailProps = {
  data: AuditTrailData
  currentFilters: AuditFilters
}

function formatValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "No data"
  }

  return JSON.stringify(value, null, 2)
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function buildPageUrl(
  filters: AuditFilters,
  page: number,
): string {
  const params = new URLSearchParams()

  if (filters.query) {
    params.set("query", filters.query)
  }

  if (filters.moduleKey) {
    params.set("moduleKey", filters.moduleKey)
  }

  if (filters.action) {
    params.set("action", filters.action)
  }

  if (filters.entityType) {
    params.set("entityType", filters.entityType)
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom)
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo)
  }

  params.set("page", String(page))

  return `/administration/audit?${params.toString()}`
}

export function AuditTrail({
  data,
  currentFilters,
}: AuditTrailProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Audit Trail"
        description="Review immutable records of administrative and system activity across Q-NXUS."
      />

      <section aria-labelledby="audit-summary-heading">
        <h2
          id="audit-summary-heading"
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Audit summary
        </h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Matching events
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.total}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Modules recorded
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.filters.modules.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Action types
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.filters.actions.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Current page
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.page}/{data.totalPages}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="audit-filters-heading">
        <div className="mb-3 flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <h2
            id="audit-filters-heading"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Filters
          </h2>
        </div>

        <form
          method="get"
          className="grid gap-4 border-y border-border py-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <div className="lg:col-span-3">
            <label htmlFor="query" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="query"
              name="query"
              defaultValue={currentFilters.query ?? ""}
              placeholder="Description, action, entity, user or record ID"
              className="mt-2"
            />
          </div>

          <div>
            <label
              htmlFor="moduleKey"
              className="text-sm font-medium"
            >
              Module
            </label>
            <select
              id="moduleKey"
              name="moduleKey"
              defaultValue={currentFilters.moduleKey ?? ""}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All modules</option>
              {data.filters.modules.map((moduleKey) => (
                <option key={moduleKey} value={moduleKey}>
                  {formatLabel(moduleKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="action" className="text-sm font-medium">
              Action
            </label>
            <select
              id="action"
              name="action"
              defaultValue={currentFilters.action ?? ""}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All actions</option>
              {data.filters.actions.map((action) => (
                <option key={action} value={action}>
                  {formatLabel(action)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="entityType"
              className="text-sm font-medium"
            >
              Entity type
            </label>
            <select
              id="entityType"
              name="entityType"
              defaultValue={currentFilters.entityType ?? ""}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All entity types</option>
              {data.filters.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {formatLabel(entityType)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dateFrom" className="text-sm font-medium">
              Date from
            </label>
            <Input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={currentFilters.dateFrom ?? ""}
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="dateTo" className="text-sm font-medium">
              Date to
            </label>
            <Input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={currentFilters.dateTo ?? ""}
              className="mt-2"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">
              <Search />
              Apply filters
            </Button>

            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/administration/audit" />}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="audit-events-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="size-4 text-muted-foreground" />
            <h2
              id="audit-events-heading"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Events
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            Read-only history
          </span>
        </div>

        {data.events.length === 0 ? (
          <div className="border-y border-border py-10 text-center">
            <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No audit events found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust the filters or perform an administrative action.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {data.events.map((event) => (
              <article key={event.id} className="py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {formatLabel(event.action)}
                      </Badge>

                      <Badge variant="secondary">
                        {formatLabel(event.entityType)}
                      </Badge>

                      <Badge variant="outline">
                        {formatLabel(event.moduleKey)}
                      </Badge>
                    </div>

                    <p className="mt-3 text-sm font-medium">
                      {event.description ?? "Audit event"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.user
                        ? `${event.user.firstName} ${event.user.lastName} · ${event.user.email}`
                        : "System or unknown user"}
                    </p>

                    {event.entityId && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        Entity ID: {event.entityId}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-xs text-muted-foreground">
                    <p>
                      {event.createdAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </p>
                    {event.ipAddress && (
                      <p className="mt-1">IP: {event.ipAddress}</p>
                    )}
                  </div>
                </div>

                {(event.oldValues !== null ||
                  event.newValues !== null) && (
                  <details className="mt-4 border-t border-border pt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      View recorded changes
                    </summary>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                          Previous values
                        </p>
                        <pre className="max-h-96 overflow-auto border border-border bg-muted/30 p-3 text-xs">
                          {formatValue(event.oldValues)}
                        </pre>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                          New values
                        </p>
                        <pre className="max-h-96 overflow-auto border border-border bg-muted/30 p-3 text-xs">
                          {formatValue(event.newValues)}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Showing page {data.page} of {data.totalPages}
        </p>

        <div className="flex gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            disabled={data.page <= 1}
            render={
              data.page > 1 ? (
                <Link
                  href={buildPageUrl(
                    currentFilters,
                    data.page - 1,
                  )}
                />
              ) : (
                <span />
              )
            }
          >
            <ChevronLeft />
            Previous
          </Button>

          <Button
            nativeButton={false}
            variant="outline"
            disabled={data.page >= data.totalPages}
            render={
              data.page < data.totalPages ? (
                <Link
                  href={buildPageUrl(
                    currentFilters,
                    data.page + 1,
                  )}
                />
              ) : (
                <span />
              )
            }
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </footer>
    </div>
  )
}
