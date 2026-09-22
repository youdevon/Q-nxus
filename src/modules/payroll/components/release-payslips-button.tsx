"use client";

import { useActionState, useEffect } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  releasePayRunPayslips,
  type PayRunFormState,
} from "@/src/modules/payroll/actions/manage-pay-run";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

export function ReleasePayslipsButton({
  payRunId,
  unreleasedCount,
}: {
  payRunId: string;
  unreleasedCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    releasePayRunPayslips,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  const disabled = pending || unreleasedCount === 0;

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={payRunId} />
      <Button type="submit" variant="outline" disabled={disabled}>
        <Mail />
        {pending
          ? "Releasing…"
          : unreleasedCount === 0
            ? "Payslips released"
            : "Release & email payslips"}
      </Button>
    </form>
  );
}
