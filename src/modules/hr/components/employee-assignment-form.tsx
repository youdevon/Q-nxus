"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createEmployeeAssignment,
  type EmployeeAssignmentFormState,
} from "@/src/modules/hr/actions/create-employee-assignment";
import { PositionStructureDialog } from "@/src/modules/hr/components/organization-structure-dialogs";
import type { EmployeeAssignmentHistory } from "@/src/modules/hr/data/get-employee-assignments";
import type { EmployeeFormDepartment } from "@/src/modules/hr/data/get-employee-form-data";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";

const initialState: EmployeeAssignmentFormState = {
  status: "idle",
  message: "",
};

function toStructureDepartments(
  departments: EmployeeFormDepartment[],
): DepartmentRecord[] {
  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: null,
    description: null,
    isActive: true,
    updatedAt: "",
    employeeCount: 0,
    positions: department.positions.map((position) => ({
      id: position.id,
      title: position.title,
      code: null,
      description: null,
      systemRoleCode: null,
      reportsToPositionId: null,
      isActive: true,
      updatedAt: "",
      employeeCount: 0,
    })),
  }));
}

function appendPositionToDepartments(
  departments: EmployeeFormDepartment[],
  created: { id: string; title: string; departmentId: string },
): EmployeeFormDepartment[] {
  return departments.map((department) => {
    if (department.id !== created.departmentId) {
      return department;
    }

    if (department.positions.some((position) => position.id === created.id)) {
      return department;
    }

    return {
      ...department,
      positions: [...department.positions, created].sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    };
  });
}

export function EmployeeAssignmentForm({
  history,
  departments: initialDepartments,
}: {
  history: EmployeeAssignmentHistory;
  departments: EmployeeFormDepartment[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createEmployeeAssignment,
    initialState,
  );

  const [departments, setDepartments] = useState(initialDepartments);
  const [departmentId, setDepartmentId] = useState(
    history.employee.departmentId ?? "",
  );
  const [positionId, setPositionId] = useState(
    history.employee.positionId ?? "",
  );
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  const positions = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)
        ?.positions ?? [],
    [departmentId, departments],
  );

  const structureDepartments = useMemo(
    () => toStructureDepartments(departments),
    [departments],
  );

  useEffect(() => {
    if (
      positionId &&
      !positions.some((position) => position.id === positionId)
    ) {
      setPositionId("");
    }
  }, [positionId, positions]);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  const hasCurrentPosition = Boolean(history.employee.positionId);

  function handlePositionCreated(
    entityId?: string,
    createdEntity?: { id: string; title: string; departmentId: string },
  ) {
    if (!entityId || !createdEntity) {
      return;
    }

    setDepartments((current) => appendPositionToDepartments(current, createdEntity));

    if (createdEntity.departmentId === departmentId) {
      setPositionId(entityId);
    } else {
      setDepartmentId(createdEntity.departmentId);
      setPositionId(entityId);
    }

    router.refresh();
  }

  return (
    <>
      <form action={action}>
        <PageShell>
          <input type="hidden" name="employeeId" value={history.employee.id} />

          <input
            type="hidden"
            name="employeeUpdatedAt"
            value={history.employee.updatedAt}
          />

          <input
            type="hidden"
            name="returnTo"
            value={`/people/employees/${history.employee.id}`}
          />

          <PeoplePageHeader
            title={hasCurrentPosition ? "Change Assignment" : "Assign to Position"}
            description={`${history.employee.firstName} ${history.employee.lastName} · ${history.employee.employeeNumber}`}
            backHref={`/people/employees/${history.employee.id}`}
            backLabel="Employee"
            actions={
              <FormPageActions
                cancelHref={`/people/employees/${history.employee.id}`}
              >
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending
                    ? "Saving…"
                    : hasCurrentPosition
                      ? "Save assignment"
                      : "Assign to position"}
                </Button>
              </FormPageActions>
            }
          />

          {state.status !== "idle" && (
            <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <section>
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Assignment details
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="assignmentType" className="text-sm font-medium">
                  Assignment type
                </label>

                <select
                  id="assignmentType"
                  name="assignmentType"
                  defaultValue={
                    hasCurrentPosition ? "TRANSFER" : "INITIAL_APPOINTMENT"
                  }
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="INITIAL_APPOINTMENT">Initial appointment</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="PROMOTION">Promotion</option>
                  <option value="DEMOTION">Demotion</option>
                  <option value="ACTING_APPOINTMENT">Acting appointment</option>
                  <option value="TEMPORARY_ASSIGNMENT">Temporary assignment</option>
                  <option value="SECONDMENT">Secondment</option>
                  <option value="REASSIGNMENT">Reassignment</option>
                  <option value="RETURN_TO_SUBSTANTIVE">
                    Return to substantive
                  </option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="startDate" className="text-sm font-medium">
                  Effective date
                </label>

                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  min={history.employee.hireDate}
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <label htmlFor="departmentId" className="text-sm font-medium">
                  Department
                </label>

                <select
                  id="departmentId"
                  name="departmentId"
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setPositionId("");
                  }}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="positionId" className="text-sm font-medium">
                    Position
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    disabled={!departmentId}
                    onClick={() => setPositionDialogOpen(true)}
                  >
                    <Plus />
                    Add new position
                  </Button>
                </div>

                <select
                  id="positionId"
                  name="positionId"
                  value={positionId}
                  onChange={(event) => setPositionId(event.target.value)}
                  disabled={!departmentId}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                >
                  <option value="">No position</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="referenceNumber" className="text-sm font-medium">
                  Reference number
                </label>

                <Input
                  id="referenceNumber"
                  name="referenceNumber"
                  placeholder="Letter, memo or approval reference"
                  className="mt-2"
                />
              </div>

              <label className="flex items-center gap-3 pt-8">
                <input type="checkbox" name="isActing" className="size-4" />
                <span className="text-sm font-medium">Acting assignment</span>
              </label>

              <div className="md:col-span-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  Reason
                </label>

                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  className="mt-2"
                  placeholder="Explain the transfer, promotion or reassignment."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </label>

                <Textarea id="notes" name="notes" rows={3} className="mt-2" />
              </div>
            </div>
          </section>
        </PageShell>
      </form>

      <PositionStructureDialog
        open={positionDialogOpen}
        onOpenChange={setPositionDialogOpen}
        departments={structureDepartments}
        defaultDepartmentId={departmentId}
        onSuccess={handlePositionCreated}
      />
    </>
  );
}
