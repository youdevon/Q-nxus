"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Network,
  Pencil,
  Plus,
  Save,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { FieldHint, FieldLabel, MetaLabel } from "@/src/components/ui/field";
import {
  updatePositionReporting,
  type PositionReportingFormState,
} from "@/src/modules/hr/actions/update-position-reporting";
import { AttachEmployeeToPositionDialog } from "@/src/modules/hr/components/attach-employee-to-position-dialog";
import { DeleteDepartmentButton } from "@/src/modules/hr/components/delete-department-button";
import { OrganizationStructureTree } from "@/src/modules/hr/components/organization-structure-tree";
import {
  DepartmentStructureDialog,
  PositionStructureDialog,
} from "@/src/modules/hr/components/organization-structure-dialogs";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import type { OrganizationChartData } from "@/src/modules/hr/data/get-organization-chart";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";
import {
  flattenOrganizationPositions,
  getEligibleReportingManagers,
  type OrganizationSelection,
} from "@/src/modules/hr/lib/organization-chart-view";

type PeopleOrganizationWorkspaceProps = {
  departments: DepartmentRecord[];
  chartData: OrganizationChartData;
  canManage: boolean;
  initialSelection?: OrganizationSelection;
};

const reportingInitialState: PositionReportingFormState = {
  status: "idle",
  message: "",
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

function InlineReportingForm({
  positionId,
  updatedAt,
  reportsToPositionId,
  availableManagers,
}: {
  positionId: string;
  updatedAt: string;
  reportsToPositionId: string | null;
  availableManagers: {
    id: string;
    title: string;
    code: string | null;
    departmentName: string;
    holderNames: string[];
  }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    updatePositionReporting,
    reportingInitialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state, router]);

  return (
    <form
      key={`${positionId}-${updatedAt}`}
      action={action}
      className="space-y-4"
    >
      <input type="hidden" name="positionId" value={positionId} />
      <input type="hidden" name="updatedAt" value={updatedAt} />

      <div>
        <FieldLabel htmlFor="reportsToPositionId">
          Reports to position
        </FieldLabel>
        <select
          id="reportsToPositionId"
          name="reportsToPositionId"
          defaultValue={reportsToPositionId ?? ""}
          className="mt-2 flex h-10 w-full border border-input bg-transparent px-3 text-sm"
        >
          <option value="">No reporting position — top level</option>
          {availableManagers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.title}
              {manager.code ? ` (${manager.code})` : ""}
              {" · "}
              {manager.departmentName}
              {manager.holderNames.length > 0
                ? ` · ${manager.holderNames.join(", ")}`
                : " · Vacant"}
            </option>
          ))}
        </select>
        <FieldHint>
          Positions below this position are excluded to prevent circular
          reporting relationships.
        </FieldHint>
      </div>

      {(state.status === "error" || state.status === "conflict") && (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      <Button type="submit" disabled={pending}>
        <Save />
        {pending ? "Saving…" : "Save reporting line"}
      </Button>
    </form>
  );
}

export function PeopleOrganizationWorkspace({
  departments,
  chartData,
  canManage,
  initialSelection,
}: PeopleOrganizationWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<OrganizationSelection>(() =>
    parseInitialSelection(departments, initialSelection),
  );
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] =
    useState<DepartmentRecord | null>(null);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [positionDialogDepartmentId, setPositionDialogDepartmentId] = useState<
    string | undefined
  >();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<{
    id: string;
    title: string;
    code: string | null;
    description: string | null;
    systemRoleCode: string | null;
    isActive: boolean;
    updatedAt: string;
    departmentName: string;
  } | null>(null);
  function updateSelection(nextSelection: OrganizationSelection) {
    setSelection(nextSelection);
    setAssignDialogOpen(false);

    const params = new URLSearchParams();

    if (nextSelection.type === "department") {
      params.set("department", nextSelection.departmentId);
    } else if (nextSelection.type === "position") {
      params.set("position", nextSelection.positionId);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";

    router.replace(`/people/structure${suffix}`, {
      scroll: false,
    });
  }

  const selectedDepartment = useMemo(() => {
    if (selection.type === "department") {
      return departments.find(
        (department) => department.id === selection.departmentId,
      );
    }

    if (selection.type === "position") {
      return departments.find((department) =>
        department.positions.some(
          (position) => position.id === selection.positionId,
        ),
      );
    }

    return undefined;
  }, [departments, selection]);

  let selectedPosition:
    | (typeof departments)[number]["positions"][number] & {
        departmentId: string;
        departmentName: string;
      }
    | undefined;

  if (selection.type === "position") {
    for (const department of departments) {
      const position = department.positions.find(
        (item) => item.id === selection.positionId,
      );

      if (position) {
        selectedPosition = {
          ...position,
          departmentId: department.id,
          departmentName: department.name,
        };
        break;
      }
    }
  }

  const chartHref = useMemo(() => {
    const params = new URLSearchParams();

    if (selection.type === "department") {
      params.set("department", selection.departmentId);
    } else if (selection.type === "position") {
      params.set("position", selection.positionId);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";

    return `/people/structure/chart${suffix}`;
  }, [selection]);

  const chartPositionById = useMemo(
    () => flattenOrganizationPositions(chartData),
    [chartData],
  );

  const reportingOverview = useMemo(() => {
    return [...chartPositionById.values()]
      .map((position) => ({
        id: position.id,
        title: position.title,
        departmentName: position.departmentName,
        reportsToTitle: position.reportsToPositionId
          ? (chartPositionById.get(position.reportsToPositionId)?.title ??
            "Unknown position")
          : null,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [chartPositionById]);

  const availableManagers = useMemo(() => {
    if (!selectedPosition) {
      return [];
    }

    return getEligibleReportingManagers(
      selectedPosition.id,
      chartPositionById,
    ).map((manager) => ({
      id: manager.id,
      title: manager.title,
      code: manager.code,
      departmentName: manager.departmentName,
      holderNames: manager.holders.map((holder) => holder.employeeName),
    }));
  }, [selectedPosition, chartPositionById]);

  function openNewDepartment() {
    setEditingDepartment(null);
    setDepartmentDialogOpen(true);
  }

  function openEditDepartment(department: DepartmentRecord) {
    setEditingDepartment(department);
    setDepartmentDialogOpen(true);
    updateSelection({ type: "department", departmentId: department.id });
  }

  function openNewPosition(departmentId?: string) {
    setEditingPosition(null);
    setPositionDialogDepartmentId(
      departmentId ??
        (selection.type === "department"
          ? selection.departmentId
          : selectedDepartment?.id),
    );
    setPositionDialogOpen(true);
  }

  function openEditPosition() {
    if (!selectedPosition) {
      return;
    }

    setEditingPosition({
      id: selectedPosition.id,
      title: selectedPosition.title,
      code: selectedPosition.code,
      description: selectedPosition.description,
      systemRoleCode: selectedPosition.systemRoleCode,
      isActive: selectedPosition.isActive,
      updatedAt: selectedPosition.updatedAt,
      departmentName: selectedPosition.departmentName,
    });
    setPositionDialogOpen(true);
  }

  function handleStructureSaved(kind: "department" | "position", entityId?: string) {
    router.refresh();

    if (!entityId) {
      return;
    }

    if (kind === "department") {
      updateSelection({ type: "department", departmentId: entityId });
      return;
    }

    updateSelection({ type: "position", positionId: entityId });
  }

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Organization"
        description="Create departments and positions, and set who reports where — all in one place."
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={chartHref} />}
            >
              <Network />
              View chart
            </Button>

            {canManage ? (
              <Button
                type="button"
                variant="outline"
                disabled={departments.length === 0}
                onClick={() => openNewPosition()}
              >
                <BriefcaseBusiness />
                New position
              </Button>
            ) : null}

            {canManage ? (
              <Button type="button" onClick={openNewDepartment}>
                <Plus />
                New department
              </Button>
            ) : null}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-5">
        <div>
          <MetaLabel>Departments</MetaLabel>
          <p className="mt-1 text-2xl font-semibold">
            {chartData.totals.departments}
          </p>
        </div>

        <div>
          <MetaLabel>Positions</MetaLabel>
          <p className="mt-1 text-2xl font-semibold">
            {chartData.totals.positions}
          </p>
        </div>

        <div>
          <MetaLabel>Occupied</MetaLabel>
          <p className="mt-1 text-2xl font-semibold">
            {chartData.totals.occupiedPositions}
          </p>
        </div>

        <div>
          <MetaLabel>Vacant</MetaLabel>
          <p className="mt-1 text-2xl font-semibold">
            {chartData.totals.vacantPositions}
          </p>
        </div>

        <div>
          <MetaLabel>Acting assignments</MetaLabel>
          <p className="mt-1 text-2xl font-semibold">
            {chartData.totals.actingAssignments}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside>
          <p className="mb-2 text-sm font-semibold tracking-wide uppercase">
            Structure
          </p>

          <OrganizationStructureTree
            departments={departments}
            selection={selection}
            onSelect={updateSelection}
            canManage={canManage}
            onEditDepartment={openEditDepartment}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          {selection.type === "org" && (
            <>
              <section className="border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-wide uppercase">
                      Departments
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Select a department to manage its positions, or open a
                      position to set reporting.
                    </p>
                  </div>

                  {canManage ? (
                    <Button type="button" size="sm" onClick={openNewDepartment}>
                      <Plus />
                      New department
                    </Button>
                  ) : null}
                </div>

                {departments.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No departments configured yet.
                    {canManage
                      ? " Create the first department to get started."
                      : ""}
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border">
                    {departments.map((department) => (
                      <li
                        key={department.id}
                        className="flex items-stretch"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/20"
                          onClick={() =>
                            updateSelection({
                              type: "department",
                              departmentId: department.id,
                            })
                          }
                        >
                          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {department.name}
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                              {department.positions.length}
                              {" "}
                              position
                              {department.positions.length === 1 ? "" : "s"}
                              {department.code
                                ? ` · ${department.code}`
                                : ""}
                            </span>
                          </span>
                        </button>

                        {canManage ? (
                          <div className="flex items-center pr-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Edit ${department.name}`}
                              onClick={() => openEditDepartment(department)}
                            >
                              <Pencil />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {reportingOverview.length > 0 ? (
                <section className="border border-border p-4">
                  <p className="text-sm font-semibold tracking-wide uppercase">
                    Reporting overview
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Who reports to whom across the organization. Select a
                    position in the tree to change a line.
                  </p>

                  <div className="mt-4 overflow-x-auto border border-border">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="border-b border-border bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Position</th>
                          <th className="px-3 py-2.5 font-medium">
                            Department
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Reports to
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportingOverview.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                className="font-medium hover:underline"
                                onClick={() =>
                                  updateSelection({
                                    type: "position",
                                    positionId: row.id,
                                  })
                                }
                              >
                                {row.title}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {row.departmentName}
                            </td>
                            <td className="px-3 py-3">
                              {row.reportsToTitle ?? (
                                <span className="text-muted-foreground">
                                  Top level
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {selectedDepartment && selection.type === "department" && (
            <section className="border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-wide uppercase">
                    Department
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <p className="font-medium">{selectedDepartment.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedDepartment.positions.length}
                    {" "}
                    position
                    {selectedDepartment.positions.length === 1 ? "" : "s"}
                    {selectedDepartment.code
                      ? ` · ${selectedDepartment.code}`
                      : ""}
                  </p>
                  {selectedDepartment.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedDepartment.description}
                    </p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDepartment(selectedDepartment)}
                    >
                      <Pencil />
                      Edit department
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openNewPosition(selectedDepartment.id)}
                    >
                      <Plus />
                      New position
                    </Button>
                    <DeleteDepartmentButton
                      departmentId={selectedDepartment.id}
                      departmentName={selectedDepartment.name}
                      size="sm"
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Positions
                </p>

                {selectedDepartment.positions.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No positions in this department yet.
                    {canManage
                      ? " Create a position, then set its reporting line."
                      : ""}
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {selectedDepartment.positions.map((position) => {
                      const reportsToTitle = position.reportsToPositionId
                        ? (chartPositionById.get(position.reportsToPositionId)
                            ?.title ?? "Unknown position")
                        : null;

                      return (
                        <li key={position.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                            onClick={() =>
                              updateSelection({
                                type: "position",
                                positionId: position.id,
                              })
                            }
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" />
                                <span className="font-medium">
                                  {position.title}
                                </span>
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {position.employeeCount}
                                {" "}
                                employee
                                {position.employeeCount === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {reportsToTitle
                                ? `Reports to ${reportsToTitle}`
                                : "Top level"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}

          {selectedPosition && selection.type === "position" && (
            <section className="border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-wide uppercase">
                    Position
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <BriefcaseBusiness className="size-4 text-muted-foreground" />
                    <p className="font-medium">{selectedPosition.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPosition.departmentName}
                    {selectedPosition.code
                      ? ` · ${selectedPosition.code}`
                      : ""}
                  </p>
                  {selectedPosition.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedPosition.description}
                    </p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPosition.isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setAssignDialogOpen(true)}
                      >
                        <UserPlus />
                        Assign employee
                      </Button>
                    ) : null}
                    {selectedDepartment ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openEditDepartment(selectedDepartment)
                        }
                      >
                        <Building2 />
                        Edit department
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openEditPosition}
                    >
                      <Pencil />
                      Edit position
                    </Button>
                  </div>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {selectedPosition.employeeCount}{" "}
                employee
                {selectedPosition.employeeCount === 1 ? "" : "s"} currently
                assigned
                {canManage && selectedPosition.isActive
                  ? ". Use Assign employee to attach someone to this seat."
                  : "."}
              </p>

              <div className="mt-5 border border-border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Network className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Reporting line
                  </p>
                </div>

                {canManage ? (
                  <InlineReportingForm
                    positionId={selectedPosition.id}
                    updatedAt={selectedPosition.updatedAt}
                    reportsToPositionId={selectedPosition.reportsToPositionId}
                    availableManagers={availableManagers}
                  />
                ) : (
                  <p className="text-sm">
                    {selectedPosition.reportsToPositionId
                      ? (
                          <>
                            Reports to{" "}
                            <span className="font-medium">
                              {chartPositionById.get(
                                selectedPosition.reportsToPositionId,
                              )?.title ?? "Unknown position"}
                            </span>
                          </>
                        )
                      : (
                          <span className="text-muted-foreground">
                            Top level — no reporting position
                          </span>
                        )}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {canManage ? (
        <>
          <DepartmentStructureDialog
            open={departmentDialogOpen}
            onOpenChange={(open) => {
              setDepartmentDialogOpen(open);
              if (!open) {
                setEditingDepartment(null);
              }
            }}
            department={editingDepartment}
            onSuccess={(entityId) =>
              handleStructureSaved("department", entityId)
            }
          />

          <PositionStructureDialog
            open={positionDialogOpen}
            onOpenChange={(open) => {
              setPositionDialogOpen(open);
              if (!open) {
                setEditingPosition(null);
              }
            }}
            departments={departments}
            defaultDepartmentId={positionDialogDepartmentId}
            position={editingPosition}
            onSuccess={(entityId) =>
              handleStructureSaved("position", entityId)
            }
          />

          {selectedPosition ? (
            <AttachEmployeeToPositionDialog
              open={assignDialogOpen}
              onOpenChange={setAssignDialogOpen}
              positionId={selectedPosition.id}
              positionTitle={selectedPosition.title}
              departmentName={selectedPosition.departmentName}
              onSuccess={() => router.refresh()}
            />
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
