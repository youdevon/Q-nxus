"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteEmploymentContract,
  type DeleteEmploymentContractState,
} from "@/src/modules/hr/actions/delete-employment-contract";

const initialState: DeleteEmploymentContractState = {
  status: "idle",
  message: "",
};

export function DeleteEmploymentContractButton({
  employeeId,
  contractId,
}: {
  employeeId: string;
  contractId: string;
}) {
  const [state, action, pending] = useActionState(
    deleteEmploymentContract,
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
          "Permanently delete this employment contract?\n\nDelete only if it was created in error. Prefer Amend for corrections after the contract has been used. This cannot be undone.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="confirmed" value="on" />
      <Button type="submit" variant="destructive" disabled={pending}>
        <Trash2 />
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </form>
  );
}
