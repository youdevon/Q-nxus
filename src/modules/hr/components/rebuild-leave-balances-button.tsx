"use client";

import { useActionState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  rebuildLeaveBalancesForLeaveType,
  type LeaveEntitlementFormState,
} from "@/src/modules/hr/actions/manage-leave-entitlement-rule";

const initialState: LeaveEntitlementFormState = {
  status: "idle",
  message: "",
};

export function RebuildLeaveBalancesButton({
  leaveTypeId,
}: {
  leaveTypeId: string;
}) {
  const [state, formAction, pending] = useActionState(
    rebuildLeaveBalancesForLeaveType,
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
    <form action={formAction}>
      <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw />
        {pending ? "Rebuilding…" : "Rebuild balances"}
      </Button>
    </form>
  );
}
