"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateAchExportSettings,
  type AchSettingsFormState,
} from "@/src/modules/payroll/actions/update-ach-export-settings";
import {
  FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  formatFcbLegacyExportLabel,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import type { AchExportSettings } from "@/src/modules/payroll/lib/ach/ach-settings";
import { isLegacyTransactionOverrideActive } from "@/src/modules/payroll/lib/ach/ach-settings";

const idle: AchSettingsFormState = { status: "idle", message: "" };

export function AchSettingsForm({
  settings,
  nextTraceSequence,
  canManage,
}: {
  settings: AchExportSettings;
  nextTraceSequence: number;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateAchExportSettings,
    idle,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const overrideActive = isLegacyTransactionOverrideActive(settings);

  return (
    <form action={formAction} className="grid max-w-2xl gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={settings.enabled ? "success" : "secondary"}>
          ACH {settings.enabled ? "On" : "Off"}
        </Badge>
        {overrideActive ? (
          <Badge variant="warning">Legacy txn code override active</Badge>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          className="size-4"
          defaultChecked={settings.enabled}
          disabled={!canManage}
        />
        Enable FCB ACH salary file export
      </label>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Export format</label>
        <Input
          name="exportFormat"
          defaultValue={settings.exportFormat}
          readOnly
        />
        <p className="text-xs text-muted-foreground">
          {formatFcbLegacyExportLabel(FCB_TT_LEGACY_NACHA_NO_HEADER_V1)}. Default
          Transactions is reserved for a future exporter.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Transaction code policy</label>
        <select
          name="transactionCodePolicy"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          defaultValue={settings.transactionCodePolicy}
          disabled={!canManage}
        >
          <option value="USE_ACCOUNT_TYPE">
            Use employee account type (Savings→32, Chequing→22)
          </option>
          <option value="FORCE_LEGACY_CODE">
            Force configured legacy code for all rows
          </option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Legacy transaction code</label>
        <select
          name="legacyTransactionCode"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          defaultValue={settings.legacyTransactionCode}
          disabled={!canManage}
        >
          <option value="32">32 — Savings credit</option>
          <option value="22">22 — Checking/current credit</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">
          ODFI routing (trace prefix)
        </label>
        <Input
          name="odfiRoutingNumber"
          defaultValue={settings.odfiRoutingNumber}
          placeholder="010100013"
          disabled={!canManage}
          required
        />
        <p className="text-xs text-muted-foreground">
          First 8 digits + org sequence = 15-digit Trace Number (positions
          80–94). This is a configurable stand-in —{" "}
          <strong>not</strong> a verified FCB/EasyPay algorithm. Never derive
          the payment date from the trace; the date belongs only in{" "}
          <code className="text-[11px]">SALARY YYYYMMDD</code> (positions
          40–54).
        </p>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">ACH banks & routing</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage which Trinidad & Tobago banks are accepted on salary ACH
          files (routing numbers, ACH credits flag, account length hints).
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="mt-3"
          render={<Link href="/payroll/settings/ach/banks" />}
        >
          Manage ACH banks
        </Button>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Next trace sequence</label>
        <Input value={String(nextTraceSequence).padStart(7, "0")} readOnly />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Entry description</label>
        <Input
          name="entryDescription"
          defaultValue={settings.entryDescription}
          disabled={!canManage}
        />
        <p className="text-xs text-muted-foreground">
          Salary reference becomes{" "}
          <code className="text-[11px]">SALARY YYYYMMDD</code> on the ACH file.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allowExportWithWarnings"
          className="size-4"
          defaultChecked={settings.allowExportWithWarnings}
          disabled={!canManage}
        />
        Allow export when name/banking warnings exist
      </label>

      {canManage ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save ACH settings"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">View only</p>
      )}
    </form>
  );
}
