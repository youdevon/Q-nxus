"use client";

import { useActionState, useEffect } from "react";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  markEmploymentContractCollected,
  type MarkContractCollectedState,
} from "@/src/modules/hr/actions/mark-employment-contract-collected";

const initialState: MarkContractCollectedState = {
  status: "idle",
  message: "",
};

export function MarkContractCollectedButton({
  employeeId,
  contractId,
}: {
  employeeId: string;
  contractId: string;
}) {
  const [state, action, pending] = useActionState(
    markEmploymentContractCollected,
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
    <form action={action}>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="contractId" value={contractId} />
      <Button type="submit" variant="outline" disabled={pending}>
        <PackageCheck />
        {pending ? "Saving…" : "Mark as collected"}
      </Button>
    </form>
  );
}
