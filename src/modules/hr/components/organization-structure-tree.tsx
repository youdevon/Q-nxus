"use client";

import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  Network,
  Pencil,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";
import type { OrganizationSelection } from "@/src/modules/hr/lib/organization-chart-view";

type OrganizationStructureTreeProps = {
  departments: DepartmentRecord[];
  selection: OrganizationSelection;
  onSelect: (selection: OrganizationSelection) => void;
  canManage?: boolean;
  onEditDepartment?: (department: DepartmentRecord) => void;
};

export function OrganizationStructureTree({
  departments,
  selection,
  onSelect,
  canManage = false,
  onEditDepartment,
}: OrganizationStructureTreeProps) {
  const expandedDepartmentIds = new Set<string>();

  if (selection.type === "department") {
    expandedDepartmentIds.add(selection.departmentId);
  }

  if (selection.type === "position") {
    for (const department of departments) {
      if (
        department.positions.some(
          (position) => position.id === selection.positionId,
        )
      ) {
        expandedDepartmentIds.add(department.id);
      }
    }
  }

  return (
    <nav
      aria-label="Organization structure"
      className="flex flex-col border border-border"
    >
      <button
        type="button"
        className={[
          "flex items-center gap-2 border-b border-border px-3 py-3 text-left text-sm transition-colors",
          selection.type === "org"
            ? "bg-muted/40 font-medium"
            : "hover:bg-muted/20",
        ].join(" ")}
        onClick={() => onSelect({ type: "org" })}
      >
        <Network className="size-4 shrink-0 text-muted-foreground" />
        Whole organization
      </button>

      {departments.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          No departments configured
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-y-auto">
          {departments.map((department) => {
            const isExpanded = expandedDepartmentIds.has(department.id);
            const isDepartmentSelected =
              selection.type === "department" &&
              selection.departmentId === department.id;

            return (
              <div
                key={department.id}
                className="border-b border-border last:border-b-0"
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    aria-label={
                      isExpanded ? "Collapse department" : "Expand department"
                    }
                    className="px-2 text-muted-foreground hover:bg-muted/20"
                    onClick={() =>
                      onSelect({
                        type: "department",
                        departmentId: department.id,
                      })
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    className={[
                      "flex min-w-0 flex-1 items-start gap-2 px-2 py-3 text-left text-sm transition-colors",
                      isDepartmentSelected
                        ? "bg-muted/40 font-medium"
                        : "hover:bg-muted/20",
                    ].join(" ")}
                    onClick={() =>
                      onSelect({
                        type: "department",
                        departmentId: department.id,
                      })
                    }
                  >
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                    <span className="min-w-0">
                      <span className="block truncate">{department.name}</span>

                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {department.code && (
                          <Badge variant="outline" className="text-[10px]">
                            {department.code}
                          </Badge>
                        )}

                        {!department.isActive && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </span>
                    </span>
                  </button>

                  {canManage && onEditDepartment ? (
                    <div className="flex items-center pr-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${department.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditDepartment(department);
                        }}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/10">
                    {department.positions.length === 0 ? (
                      <p className="px-10 py-3 text-xs text-muted-foreground">
                        No positions in this department
                      </p>
                    ) : (
                      department.positions.map((position) => {
                        const isPositionSelected =
                          selection.type === "position" &&
                          selection.positionId === position.id;

                        return (
                          <button
                            key={position.id}
                            type="button"
                            className={[
                              "flex w-full items-start gap-2 border-t border-border px-10 py-3 text-left text-sm transition-colors first:border-t-0",
                              isPositionSelected
                                ? "bg-muted/40 font-medium"
                                : "hover:bg-muted/20",
                            ].join(" ")}
                            onClick={() =>
                              onSelect({
                                type: "position",
                                positionId: position.id,
                              })
                            }
                          >
                            <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                            <span className="min-w-0">
                              <span className="block truncate">
                                {position.title}
                              </span>

                              <span className="mt-1 block text-xs text-muted-foreground">
                                {position.employeeCount}
                                {" "}
                                employee
                                {position.employeeCount === 1 ? "" : "s"}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
