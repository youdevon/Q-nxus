"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideLeaveRequest,
  type LeaveDecisionFormState,
} from "@/src/modules/hr/actions/decide-leave-request";

const initialState: LeaveDecisionFormState = {
  status: "idle",
  message: "",
};

export function LeaveDecisionForm({
  leaveRequestId,
  mode = "manager",
}: {
  leaveRequestId: string;
  mode?: "manager" | "hr";
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [state, formAction, pending] = useActionState(
    decideLeaveRequest,
    initialState,
  );
  const approveLabel =
    mode === "hr" ? "Confirm (HR)" : "Approve";

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      {mode === "hr" ? (
        <p className="text-sm text-muted-foreground">
          Manager approved this request. Confirm to finalize, or reject with a
          comment.
        </p>
      ) : null}

      <div>
        <label htmlFor="decisionComment" className="text-sm font-medium">
          Decision comment
        </label>

        <Textarea
          id="decisionComment"
          rows={3}
          className="mt-2"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Required when rejecting"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
          <input type="hidden" name="decision" value="APPROVE" />
          <input type="hidden" name="decisionComment" value={comment} />
          <Button type="submit" disabled={pending} variant="success">
            <Check />
            {pending ? "Saving…" : approveLabel}
          </Button>
        </form>

        <form action={formAction}>
          <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
          <input type="hidden" name="decision" value="REJECT" />
          <input type="hidden" name="decisionComment" value={comment} />
          <Button type="submit" variant="destructive" disabled={pending}>
            <X />
            Reject
          </Button>
        </form>
      </div>
    </div>
  );
}
