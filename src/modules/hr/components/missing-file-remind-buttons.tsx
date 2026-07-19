"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  remindAllMissingFileEmployees,
  remindMissingFileEmployee,
  type MissingFileReminderActionState,
} from "@/src/modules/hr/actions/remind-missing-file";

const initialState: MissingFileReminderActionState = {
  status: "idle",
  message: "",
};

function useActionToast(state: MissingFileReminderActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

export function RemindMissingFileButton({
  employeeId,
  departmentId,
  itemType,
}: {
  employeeId: string;
  departmentId?: string;
  itemType?: string;
}) {
  const [state, action, pending] = useActionState(
    remindMissingFileEmployee,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="employeeId" value={employeeId} />
      {departmentId ? (
        <input type="hidden" name="departmentId" value={departmentId} />
      ) : null}
      {itemType ? <input type="hidden" name="itemType" value={itemType} /> : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Send reminder
      </Button>
    </form>
  );
}

export function RemindAllMissingFileButton({
  departmentId,
  itemType,
  disabled,
}: {
  departmentId?: string;
  itemType?: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    remindAllMissingFileEmployees,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={action}>
      {departmentId ? (
        <input type="hidden" name="departmentId" value={departmentId} />
      ) : null}
      {itemType ? <input type="hidden" name="itemType" value={itemType} /> : null}
      <Button type="submit" disabled={pending || disabled}>
        Remind all listed
      </Button>
    </form>
  );
}
