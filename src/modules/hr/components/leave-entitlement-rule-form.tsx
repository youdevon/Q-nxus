"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveLeaveEntitlementRule,
  type LeaveEntitlementFormState,
} from "@/src/modules/hr/actions/manage-leave-entitlement-rule";
import type { LeaveTypeDetailRecord } from "@/src/modules/hr/data/get-leave-types";

const initialState: LeaveEntitlementFormState = {
  status: "idle",
  message: "",
};

export function LeaveEntitlementRuleForm({
  leaveTypeId,
  rule,
}: {
  leaveTypeId: string;
  rule?: LeaveTypeDetailRecord["entitlementRules"][number];
}) {
  const [state, formAction, pending] = useActionState(
    saveLeaveEntitlementRule,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
      {rule && <input type="hidden" name="id" value={rule.id} />}

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium" htmlFor="name">
          Rule name
        </label>
        <Input
          id="name"
          name="name"
          defaultValue={rule?.name ?? "Standard entitlement"}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="annualEntitlement">
          Annual entitlement (days)
        </label>
        <Input
          id="annualEntitlement"
          name="annualEntitlement"
          defaultValue={rule?.annualEntitlement ?? "14"}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="accrualMethod">
          Accrual method
        </label>
        <select
          id="accrualMethod"
          name="accrualMethod"
          defaultValue={rule?.accrualMethod ?? "ANNUAL_GRANT"}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ANNUAL_GRANT">Annual grant</option>
          <option value="MONTHLY">Monthly</option>
          <option value="PER_PAY_PERIOD">Per pay period</option>
          <option value="MANUAL">Manual</option>
          <option value="NONE">None</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="employmentType">
          Employment type (optional)
        </label>
        <select
          id="employmentType"
          name="employmentType"
          defaultValue={rule?.employmentType ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Any</option>
          <option value="PERMANENT">Permanent</option>
          <option value="CONTRACT">Contract</option>
          <option value="TEMPORARY">Temporary</option>
          <option value="PART_TIME">Part time</option>
          <option value="INTERN">Intern</option>
          <option value="CONSULTANT">Consultant</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="priority">
          Priority
        </label>
        <Input
          id="priority"
          name="priority"
          type="number"
          defaultValue={rule?.priority ?? 0}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="minimumServiceMonths">
          Min service (months)
        </label>
        <Input
          id="minimumServiceMonths"
          name="minimumServiceMonths"
          type="number"
          min={0}
          defaultValue={rule?.minimumServiceMonths ?? 0}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="maximumServiceMonths">
          Max service (months)
        </label>
        <Input
          id="maximumServiceMonths"
          name="maximumServiceMonths"
          type="number"
          min={0}
          defaultValue={rule?.maximumServiceMonths ?? ""}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="effectiveFrom">
          Effective from
        </label>
        <Input
          id="effectiveFrom"
          name="effectiveFrom"
          type="date"
          defaultValue={
            rule?.effectiveFrom ?? new Date().toISOString().slice(0, 10)
          }
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="effectiveTo">
          Effective to
        </label>
        <Input
          id="effectiveTo"
          name="effectiveTo"
          type="date"
          defaultValue={rule?.effectiveTo ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={rule?.isActive ?? true}
          className="size-4 rounded border-border"
        />
        Active
      </label>

      <label className="flex items-start gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          name="rebuildBalances"
          defaultChecked
          className="mt-0.5 size-4 rounded border-border"
        />
        <span>
          Rebuild current contract leave balances after save
          <span className="mt-0.5 block text-muted-foreground">
            Recalculates entitlements from active rules. Taken, reserved, and
            adjustment amounts are preserved.
          </span>
        </span>
      </label>

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : rule ? "Update rule" : "Add entitlement rule"}
        </Button>
      </div>
    </form>
  );
}
