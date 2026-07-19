import Link from "next/link";
import { Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrganizationReportingLinesPreviewData } from "@/src/modules/admin/data/get-organization-reporting-lines";

type OrganizationReportingLinesSectionProps = {
  data: OrganizationReportingLinesPreviewData;
  canManage: boolean;
};

export function OrganizationReportingLinesSection({
  data,
  canManage,
}: OrganizationReportingLinesSectionProps) {
  const preview = data.positions;

  return (
    <section id="reporting-lines" aria-labelledby="reporting-lines-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          <h2
            id="reporting-lines-heading"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Reporting lines
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {data.totals.withReportingLine} of {data.totals.positions} linked
          </Badge>

          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/people/structure" />}
          >
            <Network />
            Open Organization
          </Button>

          {canManage ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/administration/organization/reporting" />}
            >
              Bulk edit
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Day-to-day reporting is managed under People → Organization. This
        preview and the bulk editor remain available for organization-wide
        updates.
      </p>

      {data.totals.positions === 0 ? (
        <p className="text-sm text-muted-foreground">
          No positions exist yet. Create departments and positions under
          Employees → Organization, then return here to set reporting lines.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Position</th>
                <th className="px-3 py-2.5 font-medium">Department</th>
                <th className="px-3 py-2.5 font-medium">Reports to</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((position) => (
                <tr
                  key={position.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium">{position.title}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {position.code ?? "No code"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {position.departmentName}
                  </td>
                  <td className="px-3 py-3">
                    {position.reportsToTitle ?? (
                      <span className="text-muted-foreground">Top level</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totals.positions > preview.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {preview.length} of {data.totals.positions} positions. Manage
          lines in People → Organization, or use Bulk edit for the full list
          here.
        </p>
      ) : null}

      {!canManage && data.totals.positions > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Editing reporting lines requires the people.manage capability.
        </p>
      ) : null}
    </section>
  );
}
