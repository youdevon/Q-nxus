"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createLeaveType,
  updateLeaveType,
  type LeaveTypeFormState,
} from "@/src/modules/hr/actions/manage-leave-type";
import type { LeaveTypeDetailRecord } from "@/src/modules/hr/data/get-leave-types";

const initialState: LeaveTypeFormState = {
  status: "idle",
  message: "",
};

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-border"
      />
      {label}
    </label>
  );
}

export function LeaveTypeForm({
  leaveType,
}: {
  leaveType?: LeaveTypeDetailRecord | null;
}) {
  const action = leaveType ? updateLeaveType : createLeaveType;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>

        {leaveType && <input type="hidden" name="id" value={leaveType.id} />}

        <PeoplePageHeader
          title={leaveType ? "Edit Leave Type" : "New Leave Type"}
          description="Configure leave categories, balance requirements, and document rules."
          backHref={
            leaveType
              ? `/people/leave/types/${leaveType.id}`
              : "/people/leave/types"
          }
          backLabel={leaveType ? "Leave type" : "Leave types"}
          actions={
            <FormPageActions
              cancelHref={
                leaveType
                  ? `/people/leave/types/${leaveType.id}`
                  : "/people/leave/types"
              }
            >
              <Button type="submit" disabled={pending}>
                <Save />
                {pending ? "Saving…" : "Save"}
              </Button>
            </FormPageActions>
          }
        />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="code">
              Code
            </label>
            <Input
              id="code"
              name="code"
              defaultValue={leaveType?.code ?? ""}
              disabled={leaveType?.isSystem}
              required
            />
            {state.fieldErrors?.code && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.code}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={leaveType?.name ?? ""}
              required
            />
            {state.fieldErrors?.name && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={leaveType?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="minimumNoticeDays">
              Minimum notice (days)
            </label>
            <Input
              id="minimumNoticeDays"
              name="minimumNoticeDays"
              type="number"
              min={0}
              defaultValue={leaveType?.minimumNoticeDays ?? 0}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="maximumConsecutiveDays"
            >
              Max consecutive days
            </label>
            <Input
              id="maximumConsecutiveDays"
              name="maximumConsecutiveDays"
              defaultValue={leaveType?.maximumConsecutiveDays ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="documentRequiredAfter"
            >
              Document required after (days)
            </label>
            <Input
              id="documentRequiredAfter"
              name="documentRequiredAfter"
              defaultValue={leaveType?.documentRequiredAfter ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="carryForwardLimit">
              Carry-forward limit
            </label>
            <Input
              id="carryForwardLimit"
              name="carryForwardLimit"
              defaultValue={leaveType?.carryForwardLimit ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sortOrder">
              Sort order
            </label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={leaveType?.sortOrder ?? 0}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="colour">
              Colour
            </label>
            <Input
              id="colour"
              name="colour"
              defaultValue={leaveType?.colour ?? ""}
              placeholder="#2563eb"
            />
          </div>
        </div>

        <div className="grid gap-3 border-b border-border py-6 sm:grid-cols-2 lg:grid-cols-3">
          <CheckboxField
            name="isPaid"
            label="Paid leave"
            defaultChecked={leaveType?.isPaid ?? true}
          />
          <CheckboxField
            name="requiresBalance"
            label="Requires balance"
            defaultChecked={leaveType?.requiresBalance ?? true}
          />
          <CheckboxField
            name="requiresDocument"
            label="Requires document"
            defaultChecked={leaveType?.requiresDocument ?? false}
          />
          <CheckboxField
            name="allowsHalfDay"
            label="Allows half day"
            defaultChecked={leaveType?.allowsHalfDay ?? false}
          />
          <CheckboxField
            name="allowsNegativeBalance"
            label="Allows negative balance"
            defaultChecked={leaveType?.allowsNegativeBalance ?? false}
          />
          <CheckboxField
            name="carryForwardAllowed"
            label="Carry forward allowed"
            defaultChecked={leaveType?.carryForwardAllowed ?? false}
          />
          <CheckboxField
            name="isActive"
            label="Active"
            defaultChecked={leaveType?.isActive ?? true}
          />
        </div>
      </PageShell>
    </form>
  );
}
