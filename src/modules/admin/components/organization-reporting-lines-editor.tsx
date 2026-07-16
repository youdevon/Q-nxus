"use client";

import { useActionState, useEffect } from "react";
import { Network, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  saveOrganizationReportingLines,
  type OrganizationReportingLinesFormState,
} from "@/src/modules/admin/actions/save-organization-reporting-lines";
import type { OrganizationReportingLinesData } from "@/src/modules/admin/data/get-organization-reporting-lines";
import { AdministrationNav } from "./administration-nav";

const initialState: OrganizationReportingLinesFormState = {
  status: "idle",
  message: "",
};

function managerLabel(option: {
  title: string;
  code: string | null;
  departmentName: string;
  holderNames: string[];
}): string {
  const holders =
    option.holderNames.length > 0
      ? option.holderNames.join(", ")
      : "Vacant";

  return `${option.title}${option.code ? ` (${option.code})` : ""} · ${option.departmentName} · ${holders}`;
}

export function OrganizationReportingLinesEditor({
  data,
}: {
  data: OrganizationReportingLinesData;
}) {
  const [state, formAction, isPending] = useActionState(
    saveOrganizationReportingLines,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>
        <AdministrationNav />

        <PageHeader
          title="Reporting lines"
          description={`Bulk-edit which position each role reports to for ${data.organization.name}. For day-to-day create and reporting, use People → Organization.`}
          backHref="/administration/organization"
          backLabel="Organization"
          actions={
            <FormPageActions cancelHref="/administration/organization">
              <Button type="submit" disabled={isPending || data.positions.length === 0}>
                <Save />
                {isPending ? "Saving…" : "Save reporting lines"}
              </Button>
            </FormPageActions>
          }
        />

        {state.status !== "idle" && (
          <div
            role="alert"
            className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        <section aria-labelledby="reporting-lines-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-muted-foreground" />
              <h2
                id="reporting-lines-heading"
                className="text-sm font-semibold tracking-wide uppercase"
              >
                Position hierarchy
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {data.totals.positions} position
                {data.totals.positions === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {data.totals.withReportingLine} with reporting line
              </Badge>
              <Badge variant="outline">
                {data.totals.topLevel} top-level
              </Badge>
            </div>
          </div>

          {data.positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No positions exist yet. Create departments and positions under
              Employees → Organization before configuring reporting lines.
            </p>
          ) : (
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Position</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium">Holder</th>
                    <th className="px-3 py-2.5 font-medium">Reports to</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((position) => {
                    const options = data.managerOptions.filter(
                      (option) => option.id !== position.id,
                    );

                    return (
                      <tr
                        key={position.id}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="hidden"
                            name="positionId"
                            value={position.id}
                          />
                          <input
                            type="hidden"
                            name={`updatedAt:${position.id}`}
                            value={position.updatedAt}
                          />
                          <p className="font-medium">{position.title}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {position.code ?? "No code"}
                          </p>
                          {!position.isActive ? (
                            <Badge variant="outline" className="mt-1">
                              Inactive
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          {position.departmentName}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          {position.holderNames.length > 0
                            ? position.holderNames.join(", ")
                            : "Vacant"}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <label
                            htmlFor={`reportsToPositionId:${position.id}`}
                            className="sr-only"
                          >
                            Reports to for {position.title}
                          </label>
                          <select
                            id={`reportsToPositionId:${position.id}`}
                            name={`reportsToPositionId:${position.id}`}
                            defaultValue={position.reportsToPositionId ?? ""}
                            className="flex h-9 w-full min-w-[14rem] border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <option value="">
                              No reporting position — top level
                            </option>
                            {options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {managerLabel(option)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Circular reporting relationships are blocked. Leave supervisor
            resolution and the organization chart both use these position
            reporting lines.
          </p>
        </section>
      </PageShell>
    </form>
  );
}
