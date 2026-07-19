"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { OrganizationVisualChart } from "@/src/modules/hr/components/organization-visual-chart";
import type { OrganizationChartData } from "@/src/modules/hr/data/get-organization-chart";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";
import {
  buildOrganizationDiagramView,
  type OrganizationSelection,
} from "@/src/modules/hr/lib/organization-chart-view";

type OrganizationChartWorkspaceProps = {
  departments: DepartmentRecord[];
  chartData: OrganizationChartData;
  initialSelection?: OrganizationSelection;
};

function parseInitialSelection(
  departments: DepartmentRecord[],
  initialSelection?: OrganizationSelection,
): OrganizationSelection {
  if (!initialSelection) {
    return { type: "org" };
  }

  if (initialSelection.type === "department") {
    const exists = departments.some(
      (department) => department.id === initialSelection.departmentId,
    );

    return exists ? initialSelection : { type: "org" };
  }

  if (initialSelection.type === "position") {
    const exists = departments.some((department) =>
      department.positions.some(
        (position) => position.id === initialSelection.positionId,
      ),
    );

    return exists ? initialSelection : { type: "org" };
  }

  return { type: "org" };
}

function selectionQuery(selection: OrganizationSelection): string {
  const params = new URLSearchParams();

  if (selection.type === "department") {
    params.set("department", selection.departmentId);
  } else if (selection.type === "position") {
    params.set("position", selection.positionId);
  }

  return params.size > 0 ? `?${params.toString()}` : "";
}

export function OrganizationChartWorkspace({
  departments,
  chartData,
  initialSelection,
}: OrganizationChartWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<OrganizationSelection>(() =>
    parseInitialSelection(departments, initialSelection),
  );

  function updateSelection(nextSelection: OrganizationSelection) {
    setSelection(nextSelection);
    router.replace(`/people/structure/chart${selectionQuery(nextSelection)}`, {
      scroll: false,
    });
  }

  const selectedDepartmentName = useMemo(() => {
    if (selection.type === "department") {
      return departments.find(
        (department) => department.id === selection.departmentId,
      )?.name;
    }

    if (selection.type === "position") {
      return departments.find((department) =>
        department.positions.some(
          (position) => position.id === selection.positionId,
        ),
      )?.name;
    }

    return undefined;
  }, [departments, selection]);

  const diagramView = useMemo(
    () =>
      buildOrganizationDiagramView(
        chartData,
        selection,
        selectedDepartmentName,
      ),
    [chartData, selection, selectedDepartmentName],
  );

  const structureHref = `/people/structure${selectionQuery(selection)}`;

  return (
    <PageShell size="lg" className="max-w-[100rem]">
      <PeoplePageHeader
        title="Organization chart"
        description={diagramView.description}
        backHref={structureHref}
        backLabel="Organization"
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Network className="size-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                {diagramView.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                Colored by department · click a position to focus reporting
                lines · shared seats show a count until expanded
              </p>
            </div>
          </div>

          {selection.type !== "org" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateSelection({ type: "org" })}
            >
              Show whole organization
            </Button>
          )}
        </div>

        {diagramView.ancestors.length > 0 && (
          <div className="border border-dashed border-border p-4">
            <p className="text-sm font-semibold tracking-wide uppercase">
              Reports up to
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {diagramView.ancestors.map((ancestor, index) => (
                <div key={ancestor.id} className="flex items-center gap-2">
                  {index > 0 && (
                    <span className="text-xs text-muted-foreground">→</span>
                  )}

                  <button
                    type="button"
                    className="border border-border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() =>
                      updateSelection({
                        type: "position",
                        positionId: ancestor.id,
                      })
                    }
                  >
                    <span className="font-medium">{ancestor.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ancestor.departmentName}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <OrganizationVisualChart
          roots={diagramView.roots}
          highlightedPositionId={diagramView.highlightedPositionId}
          onSelectPosition={(positionId) =>
            updateSelection({
              type: "position",
              positionId,
            })
          }
        />
      </section>
    </PageShell>
  );
}
