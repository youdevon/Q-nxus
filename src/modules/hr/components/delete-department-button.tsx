"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteDepartment,
  type DeleteDepartmentState,
} from "@/src/modules/hr/actions/delete-department";

const initialState: DeleteDepartmentState = {
  status: "idle",
  message: "",
};

export function DeleteDepartmentButton({
  departmentId,
  departmentName,
  size = "default",
}: {
  departmentId: string;
  departmentName: string;
  size?: "default" | "sm";
}) {
  const [state, action, pending] = useActionState(
    deleteDepartment,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Permanently delete department “${departmentName}”?\n\nEmployees currently in this department will be left unassigned (contracts are kept). Positions under the department will be removed. Prefer deactivating departments that should stay in history. This cannot be undone.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="confirmed" value="on" />
      <Button type="submit" variant="destructive" size={size} disabled={pending}>
        <Trash2 />
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </form>
  );
}
