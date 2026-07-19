"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  acknowledgeLeaveRequest,
  type LeaveAcknowledgeFormState,
} from "@/src/modules/hr/actions/acknowledge-leave-request";

const initialState: LeaveAcknowledgeFormState = {
  status: "idle",
  message: "",
};

export function LeaveAcknowledgeForm({
  leaveRequestId,
}: {
  leaveRequestId: string;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [state, formAction, pending] = useActionState(
    acknowledgeLeaveRequest,
    initialState,
  );

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

      <p className="text-sm text-muted-foreground">
        Acknowledge that you have seen this leave request. Acknowledgement is
        not approval — the final approver decides after the reporting line has
        acknowledged.
      </p>

      <div>
        <label htmlFor="ackComment" className="text-sm font-medium">
          Comment (optional)
        </label>

        <Textarea
          id="ackComment"
          rows={3}
          className="mt-2"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional note"
        />
      </div>

      <form action={formAction}>
        <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
        <input type="hidden" name="comment" value={comment} />
        <Button type="submit" disabled={pending} variant="secondary">
          <Check />
          Acknowledge
        </Button>
      </form>
    </div>
  );
}
