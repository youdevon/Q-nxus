import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditModule,
  humanizeAuditDescription,
} from "@/src/lib/audit-display";
import type { AuditFilters } from "@/src/modules/admin/data/get-audit-events";
import { getAuditEventsForExport } from "@/src/modules/reports/data/get-audit-events-export";
import {
  ReportPrintEmptyState,
  ReportPrintSection,
  ReportPrintTable,
  ReportPrintTableCell,
  ReportPrintTableRow,
} from "@/src/modules/reports/components/report-print-table";

function filterSummary(filters: AuditFilters): string[] {
  const lines: string[] = [];

  if (filters.query?.trim()) {
    lines.push(`Search: ${filters.query.trim()}`);
  }
  if (filters.moduleKey) {
    lines.push(`Module: ${formatAuditModule(filters.moduleKey)}`);
  }
  if (filters.action) {
    lines.push(`Action: ${formatAuditAction(filters.action)}`);
  }
  if (filters.entityType) {
    lines.push(`Entity: ${formatAuditEntityType(filters.entityType)}`);
  }
  if (filters.dateFrom || filters.dateTo) {
    lines.push(
      `Date range: ${filters.dateFrom ?? "…"} to ${filters.dateTo ?? "…"}`,
    );
  }

  return lines;
}

export async function AuditTrailPrintContent({
  filters,
}: {
  filters: AuditFilters;
}) {
  const { headers, rows } = await getAuditEventsForExport(filters);

  if (rows.length === 0) {
    return <ReportPrintEmptyState message="No audit events match these filters." />;
  }

  return (
    <ReportPrintSection title={`${rows.length} events`}>
      <ReportPrintTable headers={headers}>
        {rows.map((row, index) => (
          <ReportPrintTableRow key={`${row[0]}-${index}`}>
            {row.map((cell, cellIndex) => (
              <ReportPrintTableCell key={`${index}-${cellIndex}`}>
                {cellIndex === 7 && cell
                  ? humanizeAuditDescription(cell)
                  : cell}
              </ReportPrintTableCell>
            ))}
          </ReportPrintTableRow>
        ))}
      </ReportPrintTable>
    </ReportPrintSection>
  );
}

export function auditTrailMetaLines(filters: AuditFilters): string[] {
  const lines = filterSummary(filters);
  return lines.length > 0 ? lines : ["All events (up to export limit)"];
}
