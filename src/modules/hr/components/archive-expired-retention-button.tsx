"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  archiveExpiredRetentionNow,
  type ArchiveRetentionActionState,
} from "@/src/modules/hr/actions/archive-correspondence-retention";

const initialState: ArchiveRetentionActionState = {
  status: "idle",
  message: "",
};

export function ArchiveExpiredRetentionButton() {
  const [state, action, pending] = useActionState(
    archiveExpiredRetentionNow,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={action}>
      <Button type="submit" variant="outline" disabled={pending}>
        Archive expired now
      </Button>
    </form>
  );
}
