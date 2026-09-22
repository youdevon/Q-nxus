"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  assignAsset,
  loadAssetAssignEmployees,
  returnAsset,
  updateAssetAssignment,
  type AssetFormState,
} from "@/src/modules/assets/actions/manage-asset";
import type {
  AssetEmployeeOption,
  AssetFormOptions,
} from "@/src/modules/assets/data/get-assets";
import {
  ASSET_ASSIGNMENT_TYPES,
  ASSET_CONDITIONS,
  labelAssetEnum,
} from "@/src/modules/assets/lib/asset-enums";
import { employeeLabel } from "@/src/modules/assets/lib/employee-label";

const initialState: AssetFormState = {
  status: "idle",
  message: "",
};

function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AssetAssignForm({
  assetId,
  options,
  currentEmployeeId,
  isAssigned = Boolean(currentEmployeeId),
  pairedChildCount = 0,
}: {
  assetId: string;
  options: AssetFormOptions;
  currentEmployeeId: string | null;
  /** True when currently with an employee or office/location. */
  isAssigned?: boolean;
  pairedChildCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [assigneeKind, setAssigneeKind] = useState<"employee" | "location">(
    "employee",
  );
  const [employees, setEmployees] = useState<AssetEmployeeOption[]>(
    options.employees,
  );
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(assignAsset, initialState);
  const today = todayInputValue();
  const title = isAssigned ? "Transfer / reassign" : "Assign asset";

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Already loaded (e.g. reopened after a successful fetch).
    if (employees.length > 0) {
      return;
    }

    let cancelled = false;
    setEmployeesLoading(true);
    setEmployeesError(null);

    void loadAssetAssignEmployees()
      .then((rows) => {
        if (cancelled) return;
        setEmployees(rows);
        if (rows.length === 0) {
          setEmployeesError("No employees found to assign to.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEmployeesError("Could not load employees. Try again.");
        toast.error("Could not load employees.");
      })
      .finally(() => {
        if (!cancelled) {
          setEmployeesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Only refetch when the form is opened; do not depend on loading flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  if (!open) {
    return (
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isAssigned
            ? "Move this asset to another employee or office location."
            : "Issue this asset to an employee or place it at an office location."}
          {pairedChildCount > 0
            ? ` ${pairedChildCount} paired item${pairedChildCount === 1 ? "" : "s"} will move with it.`
            : ""}
        </p>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {isAssigned ? "Start transfer" : "Start assignment"}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="assigneeKind" value={assigneeKind} />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Assign to</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="assigneeKindChoice"
            checked={assigneeKind === "employee"}
            onChange={() => setAssigneeKind("employee")}
          />
          Employee
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="assigneeKindChoice"
            checked={assigneeKind === "location"}
            onChange={() => setAssigneeKind("location")}
          />
          Office / location
        </label>
      </fieldset>

      {assigneeKind === "employee" ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Employee</span>
          <select
            name="employeeId"
            required
            defaultValue=""
            disabled={employeesLoading}
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            <option value="" disabled>
              {employeesLoading
                ? "Loading employees…"
                : "Select employee…"}
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employeeLabel(employee)}
              </option>
            ))}
          </select>
          {employeesError ? (
            <span className="text-xs text-destructive">{employeesError}</span>
          ) : null}
        </label>
      ) : (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Location</span>
          <select
            name="locationId"
            required
            defaultValue=""
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            <option value="" disabled>
              Select location…
            </option>
            {options.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
          {options.locations.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No active locations found. Add one under Administration first.
            </span>
          ) : null}
        </label>
      )}

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Assigned on</span>
        <Input type="date" name="assignedAt" required defaultValue={today} />
      </label>
      {isAssigned ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Previous custody ended on</span>
          <Input
            type="date"
            name="previousReturnedAt"
            defaultValue={today}
          />
        </label>
      ) : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Assignment type</span>
        <select
          key={assigneeKind}
          name="assignmentType"
          defaultValue={
            isAssigned
              ? "TRANSFER"
              : assigneeKind === "location"
                ? "OFFICE"
                : "ISSUE"
          }
          className="h-9 rounded-md border border-input bg-transparent px-3"
        >
          {ASSET_ASSIGNMENT_TYPES.filter(
            (type) => type !== "RETURN" && type !== "OFFBOARDING",
          ).map((value) => (
            <option key={value} value={value}>
              {labelAssetEnum(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Condition at issue</span>
        <select
          name="conditionAtIssue"
          defaultValue="GOOD"
          className="h-9 rounded-md border border-input bg-transparent px-3"
        >
          {ASSET_CONDITIONS.map((value) => (
            <option key={value} value={value}>
              {labelAssetEnum(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Notes</span>
        <Textarea name="notes" rows={2} />
      </label>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Saving…"
          : isAssigned
            ? "Transfer asset"
            : "Assign asset"}
      </Button>
    </form>
  );
}

export function AssetReturnForm({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(returnAsset, initialState);
  const today = todayInputValue();

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          Return asset
        </h3>
        <p className="text-xs text-muted-foreground">
          Record when this asset came back into stock.
        </p>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Start return
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          Return asset
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      <input type="hidden" name="assetId" value={assetId} />
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Returned on</span>
        <Input type="date" name="returnedAt" required defaultValue={today} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Condition on return</span>
        <select
          name="conditionAtReturn"
          defaultValue="GOOD"
          className="h-9 rounded-md border border-input bg-transparent px-3"
        >
          {ASSET_CONDITIONS.map((value) => (
            <option key={value} value={value}>
              {labelAssetEnum(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Status after return</span>
        <select
          name="nextStatus"
          defaultValue="AVAILABLE"
          className="h-9 rounded-md border border-input bg-transparent px-3"
        >
          <option value="AVAILABLE">Available</option>
          <option value="IN_REPAIR">In repair</option>
          <option value="RETIRED">Retired</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Notes</span>
        <Textarea name="notes" rows={2} />
      </label>
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Returning…" : "Mark returned"}
      </Button>
    </form>
  );
}

export function AssetAssignmentDatesForm({
  assetId,
  assignmentId,
  assignedAt,
  returnedAt,
}: {
  assetId: string;
  assignmentId: string;
  assignedAt: string;
  returnedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateAssetAssignment,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="mt-3 grid gap-2 rounded-md border border-border/70 p-3"
    >
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Correct dates
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Assigned on</span>
          <Input
            type="date"
            name="assignedAt"
            required
            defaultValue={assignedAt}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Returned on</span>
          <Input
            type="date"
            name="returnedAt"
            defaultValue={returnedAt ?? ""}
          />
        </label>
      </div>
      {returnedAt ? null : (
        <p className="text-xs text-muted-foreground">
          Leave returned blank while the asset is still out. Saving only updates
          these dates — it does not create a new movement.
        </p>
      )}
      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save date changes"}
      </Button>
    </form>
  );
}
