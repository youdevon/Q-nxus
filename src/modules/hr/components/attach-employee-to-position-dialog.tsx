"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { UserPlus, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "@/src/components/ui/field";
import {
  createEmployeeAssignment,
  type EmployeeAssignmentFormState,
} from "@/src/modules/hr/actions/create-employee-assignment";
import { loadPositionAssignmentFormData } from "@/src/modules/hr/actions/load-position-assignment-form-data";
import type { PositionAssignmentFormData } from "@/src/modules/hr/data/get-employee-assignments";

const initialState: EmployeeAssignmentFormState = {
  status: "idle",
  message: "",
};

type AttachEmployeeToPositionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: string;
  positionTitle: string;
  departmentName: string;
  onSuccess?: () => void;
};

function AttachEmployeeForm({
  data,
  onSuccess,
}: {
  data: PositionAssignmentFormData;
  onSuccess: () => void;
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    createEmployeeAssignment,
    initialState,
  );
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? "");

  const selectedEmployee = data.employees.find(
    (employee) => employee.id === employeeId,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess();
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state, onSuccess]);

  if (data.employees.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          All active employees are already on this position, or there are no
          active employees to assign.
        </p>
        <DialogFooter className="-mx-6 -mb-6 mt-1">
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form id={formId} action={formAction} className="space-y-4">
      <input type="hidden" name="departmentId" value={data.position.departmentId} />
      <input type="hidden" name="positionId" value={data.position.id} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        type="hidden"
        name="employeeUpdatedAt"
        value={selectedEmployee?.updatedAt ?? ""}
      />
      <input type="hidden" name="redirect" value="false" />

      {state.status === "error" || state.status === "conflict" ? (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`${formId}-employee`}>Employee</FieldLabel>
        <select
          id={`${formId}-employee`}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${formId}-type`}>Assignment type</FieldLabel>
          <select
            id={`${formId}-type`}
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
            <option value="TEMPORARY_ASSIGNMENT">Temporary assignment</option>
            <option value="SECONDMENT">Secondment</option>
            <option value="REASSIGNMENT">Reassignment</option>
            <option value="RETURN_TO_SUBSTANTIVE">Return to substantive</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor={`${formId}-start`}>Effective date</FieldLabel>
          <Input
            id={`${formId}-start`}
            name="startDate"
            type="date"
            min={selectedEmployee?.hireDate}
            className="mt-2"
            required
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-reason`}>Reason</FieldLabel>
        <Textarea
          id={`${formId}-reason`}
          name="reason"
          rows={2}
          className="mt-2"
          placeholder="Optional — transfer, promotion, or hire context."
        />
      </div>

      <DialogFooter className="-mx-6 -mb-6 mt-1">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? "Assigning…" : "Assign employee"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AttachEmployeeToPositionDialog({
  open,
  onOpenChange,
  positionId,
  positionTitle,
  departmentName,
  onSuccess,
}: AttachEmployeeToPositionDialogProps) {
  const [data, setData] = useState<PositionAssignmentFormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    setData(null);
    setLoadError(null);

    startLoad(async () => {
      try {
        const next = await loadPositionAssignmentFormData(positionId);

        if (!next) {
          setLoadError("This position is unavailable or inactive.");
          return;
        }

        setData(next);
      } catch {
        setLoadError("Unable to load assignable employees.");
      }
    });
  }, [open, positionId]);

  function handleSuccess() {
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="size-5" />
            Assign employee
          </DialogTitle>
          <DialogDescription>
            {positionTitle} · {departmentName}. Uses the same assignment path as
            employee profiles and contract position updates.
          </DialogDescription>
        </DialogHeader>

        {loading && !data && !loadError ? (
          <p className="text-sm text-muted-foreground">Loading employees…</p>
        ) : null}

        {loadError ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <DialogFooter className="-mx-6 -mb-6 mt-1">
              <DialogClose render={<Button type="button" variant="outline" />}>
                Close
              </DialogClose>
            </DialogFooter>
          </div>
        ) : null}

        {data ? (
          <AttachEmployeeForm
            key={`${data.position.id}-${data.employees.map((e) => e.id).join(",")}`}
            data={data}
            onSuccess={handleSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
