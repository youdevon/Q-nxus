import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  Monitor,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListSearchFilters,
  type ActiveFilterChip,
} from "@/src/components/list-search-filters";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  buildAuditChangeRows,
  formatAuditAction,
  formatAuditDateTime,
  formatAuditEntityType,
  formatAuditHeadline,
  formatAuditModule,
  formatWorkstationLabel,
} from "@/src/lib/audit-display";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { AdministrationNav } from "./administration-nav";
import type {
  AuditFilters,
  AuditTrailData,
} from "@/src/modules/admin/data/get-audit-events";

type AuditTrailProps = {
  data: AuditTrailData;
  currentFilters: AuditFilters;
};

function buildFilterChips(filters: AuditFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.moduleKey) {
    chips.push({
      key: "moduleKey",
      value: filters.moduleKey,
      label: `Module: ${formatAuditModule(filters.moduleKey)}`,
    });
  }

  if (filters.action) {
    chips.push({
      key: "action",
      value: filters.action,
      label: `Action: ${formatAuditAction(filters.action)}`,
    });
  }

  if (filters.entityType) {
    chips.push({
      key: "entityType",
      value: filters.entityType,
      label: `Entity: ${formatAuditEntityType(filters.entityType)}`,
    });
  }

  if (filters.dateFrom) {
    chips.push({
      key: "dateFrom",
      value: filters.dateFrom,
      label: `From: ${filters.dateFrom}`,
    });
  }

  if (filters.dateTo) {
    chips.push({
      key: "dateTo",
      value: filters.dateTo,
      label: `To: ${filters.dateTo}`,
    });
  }

  return chips;
}

function ActorLine({
  user,
}: {
  user: AuditTrailData["events"][number]["user"];
}) {
  if (!user) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        System or unknown user
      </p>
    );
  }

  return (
    <p className="mt-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        {user.firstName} {user.lastName}
      </span>
      <span className="text-muted-foreground"> · {user.email}</span>
    </p>
  );
}

function ChangeSummary({
  oldValues,
  newValues,
}: {
  oldValues: unknown;
  newValues: unknown;
}) {
  const rows = buildAuditChangeRows(oldValues, newValues);
  const changed = rows.filter((row) => row.changed);

  if (rows.length === 0) {
    return null;
  }

  const summaryRows = changed.length > 0 ? changed : rows;

  return (
    <details className="mt-4 border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-medium">
        {changed.length > 0
          ? `${changed.length} change${changed.length === 1 ? "" : "s"} recorded`
          : "View recorded values"}
      </summary>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 pr-4 font-medium">Field</th>
              <th className="py-2 pr-4 font-medium">Previous</th>
              <th className="py-2 font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr
                key={row.field}
                className="border-b border-border/70 align-top"
              >
                <td className="py-2.5 pr-4 font-medium">{row.label}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {row.before}
                </td>
                <td className="py-2.5">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Technical JSON
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <pre className="max-h-64 overflow-auto border border-border bg-muted/30 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(oldValues ?? null, null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto border border-border bg-muted/30 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(newValues ?? null, null, 2)}
          </pre>
        </div>
      </details>
    </details>
  );
}

export function AuditTrail({ data, currentFilters }: AuditTrailProps) {
  const filterValues = {
    query: currentFilters.query,
    moduleKey: currentFilters.moduleKey,
    action: currentFilters.action,
    entityType: currentFilters.entityType,
    dateFrom: currentFilters.dateFrom,
    dateTo: currentFilters.dateTo,
  };

  return (
    <PageShell size="lg">
      <AdministrationNav />

      <PageHeader
        title="Audit Trail"
        description="Review immutable records of administrative and system activity across Q-NXUS."
        backHref="/administration"
        backLabel="Administration"
      />

      <section aria-labelledby="audit-summary-heading">
        <SectionHeading id="audit-summary-heading" className="mb-3">
          Audit summary
        </SectionHeading>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Matching events</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.total}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Modules recorded</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.filters.modules.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Action types</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.filters.actions.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Current page</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.page}/{data.totalPages}
            </p>
          </div>
        </div>
      </section>

      <ListSearchFilters
        basePath="/administration/audit"
        clearHref="/administration/audit"
        searchPlaceholder="Description, action, entity, user or record ID"
        searchValue={currentFilters.query ?? ""}
        values={filterValues}
        chips={buildFilterChips(currentFilters)}
        fields={[
          {
            type: "checkbox",
            name: "moduleKey",
            label: "Module",
            options: data.filters.modules.map((moduleKey) => ({
              value: moduleKey,
              label: formatAuditModule(moduleKey),
            })),
            multi: false,
          },
          {
            type: "checkbox",
            name: "action",
            label: "Action",
            options: data.filters.actions.map((action) => ({
              value: action,
              label: formatAuditAction(action),
            })),
            multi: false,
          },
          {
            type: "checkbox",
            name: "entityType",
            label: "Entity type",
            options: data.filters.entityTypes.map((entityType) => ({
              value: entityType,
              label: formatAuditEntityType(entityType),
            })),
            multi: false,
          },
          {
            type: "date",
            name: "dateFrom",
            label: "Date from",
          },
          {
            type: "date",
            name: "dateTo",
            label: "Date to",
          },
        ]}
      />

      <section aria-labelledby="audit-events-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="size-4 text-muted-foreground" />
            <SectionHeading id="audit-events-heading">Events</SectionHeading>
          </div>

          <span className="text-xs text-muted-foreground">
            Read-only history
          </span>
        </div>

        {data.events.length === 0 ? (
          <div className="py-10 text-center">
            <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No audit events found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust the filters or perform an administrative action.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {data.events.map((event) => {
              const workstation = formatWorkstationLabel({
                clientHostName: event.clientHostName,
                userAgent: event.userAgent,
              });
              const headline =
                event.description?.trim() ||
                formatAuditHeadline(event.action, event.entityType);

              return (
                <article key={event.id} className="py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {formatAuditAction(event.action)}
                        </Badge>
                        <Badge variant="secondary">
                          {formatAuditEntityType(event.entityType)}
                        </Badge>
                        <Badge variant="outline">
                          {formatAuditModule(event.moduleKey)}
                        </Badge>
                      </div>

                      <p className="mt-3 text-base font-medium tracking-tight">
                        {headline}
                      </p>

                      <ActorLine user={event.user} />

                      {event.entityId && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Record{" "}
                          <span className="font-mono">{event.entityId}</span>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 space-y-1 text-xs text-muted-foreground lg:text-right">
                      <p className="text-sm text-foreground">
                        {formatAuditDateTime(event.createdAt)}
                      </p>
                      {event.ipAddress && <p>IP {event.ipAddress}</p>}
                      {workstation && (
                        <p className="inline-flex items-center gap-1.5 lg:justify-end">
                          <Monitor className="size-3.5 shrink-0" />
                          <span>{workstation}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {(event.oldValues !== null || event.newValues !== null) && (
                    <ChangeSummary
                      oldValues={event.oldValues}
                      newValues={event.newValues}
                    />
                  )}
                </article>
              );
            })}
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
                  href={buildListFilterUrl(
                    "/administration/audit",
                    filterValues,
                    { page: data.page - 1 },
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
                  href={buildListFilterUrl(
                    "/administration/audit",
                    filterValues,
                    { page: data.page + 1 },
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
    </PageShell>
  );
}
