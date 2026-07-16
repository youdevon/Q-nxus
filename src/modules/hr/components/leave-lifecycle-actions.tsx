"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  cancelLeaveRequest,
  withdrawLeaveRequest,
  type LeaveLifecycleFormState,
} from "@/src/modules/hr/actions/manage-leave-request";

const initialState: LeaveLifecycleFormState = {
  status: "idle",
  message: "",
};

export function LeaveLifecycleActions({
  leaveRequestId,
  canWithdraw,
  canCancel,
}: {
  leaveRequestId: string;
  canWithdraw: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(
    withdrawLeaveRequest,
    initialState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLeaveRequest,
    initialState,
  );

  const state = withdrawState.status !== "idle" ? withdrawState : cancelState;
  const pending = withdrawPending || cancelPending;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  if (!canWithdraw && !canCancel) {
    return null;
  }

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div>
        <SectionHeading as="h3">
          {canWithdraw ? "Withdraw request" : "Cancel approved leave"}
        </SectionHeading>
        <p className="mt-1 text-xs text-muted-foreground">
          {canWithdraw
            ? "Pull back this pending request and release the reserved balance."
            : "Cancel approved leave that has not started yet and restore the balance."}
        </p>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <div>
        <label htmlFor="lifecycleComment" className="text-sm font-medium">
          {canCancel ? "Cancellation reason" : "Comment"}
          {canCancel ? "" : " (optional)"}
        </label>

        <Textarea
          id="lifecycleComment"
          rows={3}
          className="mt-2"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={
            canCancel
              ? "Required when cancelling approved leave"
              : "Optional note for your approver"
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {canWithdraw && (
          <form action={withdrawAction}>
            <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
            <input type="hidden" name="comment" value={comment} />
            <Button type="submit" variant="destructive" disabled={pending}>
              <Undo2 />
              {withdrawPending ? "Withdrawing…" : "Withdraw"}
            </Button>
          </form>
        )}

        {canCancel && (
          <form action={cancelAction}>
            <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
            <input type="hidden" name="comment" value={comment} />
            <Button type="submit" variant="destructive" disabled={pending}>
              <Ban />
              {cancelPending ? "Cancelling…" : "Cancel leave"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
