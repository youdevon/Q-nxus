"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Save } from "lucide-react";
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
import type { EmployeeAssignmentHistory } from "@/src/modules/hr/data/get-employee-assignments";
import type { EmployeeFormDepartment } from "@/src/modules/hr/data/get-employee-form-data";

const initialState: EmployeeAssignmentFormState = {
  status: "idle",
  message: "",
};

export function EmployeeAssignmentForm({
  history,
  departments,
}: {
  history: EmployeeAssignmentHistory;
  departments: EmployeeFormDepartment[];
}) {
  const [state, action, pending] = useActionState(
    createEmployeeAssignment,
    initialState,
  );

  const [departmentId, setDepartmentId] = useState(
    history.employee.departmentId ?? "",
  );

  const positions = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)
        ?.positions ?? [],
    [departmentId, departments],
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  const hasCurrentPosition = Boolean(history.employee.positionId);

  return (
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
              onChange={(event) => setDepartmentId(event.target.value)}
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
            <label htmlFor="positionId" className="text-sm font-medium">
              Position
            </label>

            <select
              key={departmentId}
              id="positionId"
              name="positionId"
              defaultValue={
                positions.some(
                  (position) => position.id === history.employee.positionId,
                )
                  ? (history.employee.positionId ?? "")
                  : ""
              }
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
  );
}
