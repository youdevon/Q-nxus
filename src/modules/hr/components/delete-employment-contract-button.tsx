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
  cleanupEligible = false,
  redirectTo,
}: {
  employeeId: string;
  contractId: string;
  /** Expired / past-ended — stronger confirm; server uses cleanup delete rules. */
  cleanupEligible?: boolean;
  redirectTo?: string;
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
          cleanupEligible
            ? "Permanently delete this expired contract?\n\nLater expired amendments/renewals in the same chain are deleted too. A current live contract is kept (only the history link is cleared). Related leave data for removed contracts is deleted. Payslips are kept. This cannot be undone."
            : "Permanently delete this employment contract?\n\nDelete only if it was created in error. Prefer Amend for corrections after the contract has been used. This cannot be undone.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="confirmed" value="on" />
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending} size="sm">
        <Trash2 />
        {pending ? "Deleting…" : cleanupEligible ? "Delete expired" : "Delete"}
      </Button>
    </form>
  );
}
