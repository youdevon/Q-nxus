import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ListSearchFilters,
  type ActiveFilterChip,
} from "@/src/components/list-search-filters";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditModule,
} from "@/src/lib/audit-display";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { ReportExportLinks, ReportPrintLink } from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import { AdministrationNav } from "./administration-nav";
import { AuditEventsTable } from "./audit-events-table";
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

function buildAuditExportHref(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.moduleKey) params.set("moduleKey", filters.moduleKey);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return qs
    ? `/administration/audit/export?${qs}`
    : "/administration/audit/export";
}

function buildAuditPrintHref(filters: AuditFilters): string {
  return reportPrintHref("/administration/audit", {
    query: filters.query,
    moduleKey: filters.moduleKey,
    action: filters.action,
    entityType: filters.entityType,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
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
        description="Review immutable records of administrative and system activity across the platform."
        backHref="/administration"
        backLabel="Administration"
        actions={
          data.total > 0 ? (
            <PageActionsEnd>
              <ReportPrintLink href={buildAuditPrintHref(currentFilters)} />
              <ReportExportLinks href={buildAuditExportHref(currentFilters)} />
            </PageActionsEnd>
          ) : undefined
        }
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
          <AuditEventsTable
            events={data.events}
            referenceLabels={data.referenceLabels}
          />
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
