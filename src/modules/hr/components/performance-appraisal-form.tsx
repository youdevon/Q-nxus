"use client";

import { useActionState, useEffect, useState } from "react";
import { ClipboardCheck, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  createPerformanceAppraisal,
  type PerformanceAppraisalFormState,
} from "@/src/modules/hr/actions/create-performance-appraisal";
import type { AppraisalCreationData } from "@/src/modules/hr/data/get-performance-appraisals";
import { PeopleNav } from "./people-nav";

const initialState: PerformanceAppraisalFormState = {
  status: "idle",
  message: "",
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function PerformanceAppraisalForm({
  data,
}: {
  data: AppraisalCreationData;
}) {
  const [state, action, pending] = useActionState(
    createPerformanceAppraisal,
    initialState,
  );

  const initialAssignment =
    data.assignments.find(
      (assignment) => assignment.isCurrent && assignment.jobDescription,
    ) ?? data.assignments.find((assignment) => assignment.jobDescription);

  const [assignmentId, setAssignmentId] = useState(initialAssignment?.id ?? "");

  const selectedAssignment = data.assignments.find(
    (assignment) => assignment.id === assignmentId,
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

      <input type="hidden" name="employeeId" value={data.employee.id} />

      <PageHeader
        title="New Performance Appraisal"
        description={`${data.employee.firstName} ${data.employee.lastName} · ${data.employee.employeeNumber}`}
        backHref={`/people/employees/${data.employee.id}/appraisals`}
        backLabel="Appraisals"
        actions={
          <FormPageActions
            cancelHref={`/people/employees/${data.employee.id}/appraisals`}
          >
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Creating…" : "Create appraisal"}
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

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Appraisal details
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="title" className="text-sm font-medium">
              Appraisal title
            </label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. 2026 Annual Performance Appraisal"
              className="mt-2"
              required
            />
          </div>

          <div>
            <label htmlFor="appraisalNumber" className="text-sm font-medium">
              Appraisal reference
            </label>
            <Input
              id="appraisalNumber"
              name="appraisalNumber"
              className="mt-2 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="assignmentId" className="text-sm font-medium">
              Assignment being appraised
            </label>

            <select
              id="assignmentId"
              name="assignmentId"
              value={assignmentId}
              onChange={(event) => setAssignmentId(event.target.value)}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="">Select an assignment</option>

              {data.assignments.map((assignment) => (
                <option
                  key={assignment.id}
                  value={assignment.id}
                  disabled={!assignment.jobDescription}
                >
                  {assignment.positionTitle ?? assignment.departmentName}
                  {" ·"}
                  {assignment.startDate} to{" "}
                  {assignment.endDate ?? "Present"}
                  {!assignment.jobDescription ? " · No job description" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedAssignment && (
            <div className="md:col-span-2">
              <p className="text-sm font-medium">
                {selectedAssignment.positionTitle ??
                  selectedAssignment.departmentName}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {label(selectedAssignment.assignmentType)}
                {" ·"}
                {selectedAssignment.departmentName}
              </p>

              {selectedAssignment.jobDescription ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Job description version{" "}
                  {selectedAssignment.jobDescription.versionNumber}
                  {" ·"}
                  {selectedAssignment.jobDescription.criteriaCount}
                  {" "}
                  criteria
                  {" ·"}
                  {selectedAssignment.jobDescription.totalWeight}% total weight
                </p>
              ) : (
                <p className="mt-2 text-xs text-destructive">
                  This assignment cannot be appraised until a job description is
                  linked.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="periodStart" className="text-sm font-medium">
              Period start
            </label>
            <Input
              id="periodStart"
              name="periodStart"
              type="date"
              min={selectedAssignment?.startDate ?? data.employee.hireDate}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label htmlFor="periodEnd" className="text-sm font-medium">
              Period end
            </label>
            <Input
              id="periodEnd"
              name="periodEnd"
              type="date"
              max={selectedAssignment?.endDate ?? undefined}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label htmlFor="reviewDueDate" className="text-sm font-medium">
              Review due date
            </label>
            <Input
              id="reviewDueDate"
              name="reviewDueDate"
              type="date"
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="ratingScale" className="text-sm font-medium">
              Rating scale
            </label>

            <select
              id="ratingScale"
              name="ratingScale"
              defaultValue="ONE_TO_FIVE"
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="ONE_TO_FIVE">1 to 5</option>
              <option value="ONE_TO_TEN">1 to 10</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="supervisorUserId" className="text-sm font-medium">
              Appraising supervisor
            </label>

            <select
              id="supervisorUserId"
              name="supervisorUserId"
              defaultValue=""
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Assign later</option>

              {data.supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name} · {supervisor.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </form>
  );
}
