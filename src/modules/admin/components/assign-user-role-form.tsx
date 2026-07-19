"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  assignUserRole,
  type RoleAssignmentState,
} from "@/src/modules/admin/actions/manage-user-role";
import type { AssignableRole } from "@/src/modules/admin/data/get-user-access";

type AssignUserRoleFormProps = {
  userId: string;
  roles: AssignableRole[];
  /** Role IDs that already have an active or pending assignment. */
  assignedRoleIds?: string[];
};

const initialAssignmentState: RoleAssignmentState = {
  status: "idle",
  message: "",
};

function dateValue(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function AssignUserRoleForm({
  userId,
  roles,
  assignedRoleIds = [],
}: AssignUserRoleFormProps) {
  const router = useRouter();
  const [roleId, setRoleId] = useState("");
  const [useEffectiveDates, setUseEffectiveDates] = useState(false);
  const [assignmentState, assignmentAction, assignmentPending] = useActionState(
    assignUserRole,
    initialAssignmentState,
  );

  const assigned = new Set(assignedRoleIds);
  const availableRoles = roles.filter((role) => !assigned.has(role.id));

  useEffect(() => {
    if (assignmentState.status === "success") {
      toast.success(assignmentState.message);
      setRoleId("");
      setUseEffectiveDates(false);
      router.refresh();
    }

    if (assignmentState.status === "error") {
      toast.error(assignmentState.message);
    }
  }, [assignmentState, router]);

  return (
    <form action={assignmentAction} id="assign-role" className="relative z-10">
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="useEffectiveDates"
        value={useEffectiveDates ? "true" : "false"}
      />

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Assign a role
        </h2>

        <p className="mb-4 text-sm text-muted-foreground">
          Grant built-in or custom roles to this account. New employees start
          with self-service only; add broader access here.
        </p>

        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active roles are available to assign. Create a custom role under
            Users and Roles, or ensure built-in roles are seeded.
          </p>
        ) : availableRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This user already has every active role assigned.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="roleId" className="text-sm font-medium">
                Role
              </label>
              <select
                id="roleId"
                name="roleId"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                required
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Select a role</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                    {role.isSystem ? " · System" : " · Custom"}
                  </option>
                ))}
              </select>
              <FieldError message={assignmentState.errors?.roleId} />
            </div>

            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={useEffectiveDates}
                  onChange={(event) =>
                    setUseEffectiveDates(event.target.checked)
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border border-input accent-primary"
                />
                <span>
                  <span className="font-medium">Set effective dates</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Leave off to start the role immediately with no end date.
                    Turn on only when you need a delayed start or an expiry.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label
                htmlFor="effectiveFrom"
                className={`text-sm font-medium ${useEffectiveDates ? "" : "text-muted-foreground"}`}
              >
                Effective from
              </label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                defaultValue={dateValue(new Date())}
                disabled={!useEffectiveDates}
                required={useEffectiveDates}
                className="mt-2"
              />
              <FieldError message={assignmentState.errors?.effectiveFrom} />
            </div>

            <div>
              <label
                htmlFor="effectiveUntil"
                className={`text-sm font-medium ${useEffectiveDates ? "" : "text-muted-foreground"}`}
              >
                Effective until
              </label>
              <Input
                id="effectiveUntil"
                name="effectiveUntil"
                type="date"
                disabled={!useEffectiveDates}
                className="mt-2"
              />
              <FieldError message={assignmentState.errors?.effectiveUntil} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Assignment reason
              </label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Explain why this role is being assigned."
                className="mt-2 min-h-24"
              />
            </div>
          </div>
        )}

        {assignmentState.status !== "idle" && (
          <p
            className={
              assignmentState.status === "success"
                ? "mt-3 text-sm"
                : "mt-3 text-sm text-destructive"
            }
          >
            {assignmentState.message}
          </p>
        )}

        {availableRoles.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={assignmentPending}>
              <KeyRound />
              {assignmentPending ? "Assigning…" : "Assign role"}
            </Button>
          </div>
        ) : null}
      </section>
    </form>
  );
}
