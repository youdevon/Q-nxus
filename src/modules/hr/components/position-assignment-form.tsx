"use client";

import { useActionState, useEffect, useState } from "react";
import { BriefcaseBusiness, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  createEmployeeAssignment,
  type EmployeeAssignmentFormState,
} from "@/src/modules/hr/actions/create-employee-assignment";
import type { PositionAssignmentFormData } from "@/src/modules/hr/data/get-employee-assignments";
import { PeopleNav } from "./people-nav";

const initialState: EmployeeAssignmentFormState = {
  status: "idle",
  message: "",
};

export function PositionAssignmentForm({
  data,
}: {
  data: PositionAssignmentFormData;
}) {
  const [state, action, pending] = useActionState(
    createEmployeeAssignment,
    initialState,
  );

  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? "");

  const selectedEmployee = data.employees.find(
    (employee) => employee.id === employeeId,
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
    <form
      action={action}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <input
        type="hidden"
        name="departmentId"
        value={data.position.departmentId}
      />
      <input type="hidden" name="positionId" value={data.position.id} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        type="hidden"
        name="employeeUpdatedAt"
        value={selectedEmployee?.updatedAt ?? ""}
      />
      <input
        type="hidden"
        name="returnTo"
        value={`/people/structure/positions/${data.position.id}`}
      />

      <PageHeader
        title="Assign Employee"
        description={`${data.position.title} · ${data.position.departmentName}`}
        backHref={`/people/structure/positions/${data.position.id}`}
        backLabel="Position"
        actions={
          <FormPageActions
            cancelHref={`/people/structure/positions/${data.position.id}`}
          >
            <Button
              type="submit"
              disabled={pending || data.employees.length === 0}
            >
              <Save />
              {pending ? "Saving…" : "Assign employee"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status !== "idle" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {data.employees.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium">No assignable employees</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All active employees are already on this position, or there are no
            active employees to assign.
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Assignment details
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="mt-1 text-sm font-medium">{data.position.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.position.departmentName}
                {data.position.code ? ` · ${data.position.code}` : ""}
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="employeeSelect" className="text-sm font-medium">
                Employee
              </label>

              <select
                id="employeeSelect"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                {data.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.lastName}, {employee.firstName} ·{" "}
                    {employee.employeeNumber}
                    {employee.positionTitle
                      ? ` · currently ${employee.positionTitle}`
                      : employee.departmentName
                        ? ` · ${employee.departmentName}`
                        : " · unassigned"}
                  </option>
                ))}
              </select>

              {state.fieldErrors?.employeeId && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.employeeId}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="assignmentType" className="text-sm font-medium">
                Assignment type
              </label>

              <select
                id="assignmentType"
                name="assignmentType"
                defaultValue="TRANSFER"
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="INITIAL_APPOINTMENT">Initial appointment</option>
                <option value="TRANSFER">Transfer</option>
                <option value="PROMOTION">Promotion</option>
                <option value="DEMOTION">Demotion</option>
                <option value="ACTING_APPOINTMENT">Acting appointment</option>
                <option value="TEMPORARY_ASSIGNMENT">
                  Temporary assignment
                </option>
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
                min={selectedEmployee?.hireDate}
                className="mt-2"
                required
              />
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
      )}
    </form>
  );
}
