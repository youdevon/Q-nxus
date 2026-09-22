"use client";

import { useActionState, useEffect } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  setAchExportEnabled,
  type AchExportToggleState,
} from "@/src/modules/payroll/actions/set-ach-export-enabled";

const idle: AchExportToggleState = { status: "idle", message: "" };

export function AchExportSettingsToggle({
  enabled,
  canManage,
}: {
  enabled: boolean;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(setAchExportEnabled, idle);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/70 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">ACH bank file export</p>
          <Badge variant={enabled ? "success" : "secondary"}>
            {enabled ? "On" : "Off"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          When on, posted pay runs can download a First Citizens{" "}
          <code className="text-[11px]">FCB_ACH_SALARY_*.txt</code> ACH file
          (legacy NACHA type-6, no headers).
        </p>
      </div>

      {canManage ? (
        <form action={formAction}>
          <input
            type="hidden"
            name="enabled"
            value={enabled ? "false" : "true"}
          />
          <Button
            type="submit"
            size="sm"
            variant={enabled ? "outline" : "default"}
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : enabled
                ? "Turn off ACH"
                : "Turn on ACH"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">View only</p>
      )}
    </div>
  );
}
