"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, FieldLabel } from "@/src/components/ui/field";
import {
  updateLeaveOpeningBalance,
  type LeaveOpeningBalanceFormState,
} from "@/src/modules/hr/actions/update-leave-opening-balance";

const initialState: LeaveOpeningBalanceFormState = {
  status: "idle",
  message: "",
};

export type LeaveOpeningBalanceEditorRow = {
  id: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  openingBalance: string;
  availableBalance: string;
};

export function LeaveOpeningBalanceForm({
  employeeId,
  balances,
}: {
  employeeId: string;
  balances: LeaveOpeningBalanceEditorRow[];
}) {
  const [selectedBalanceId, setSelectedBalanceId] = useState(
    balances[0]?.id ?? "",
  );
  const selected = balances.find((row) => row.id === selectedBalanceId);
  const [openingBalance, setOpeningBalance] = useState(
    selected?.openingBalance ?? "0",
  );

  const [state, formAction, pending] = useActionState(
    updateLeaveOpeningBalance,
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

  if (balances.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Opening balance (cutover)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Brought-forward days from paper records. Available = opening +
          entitlement + accrued + carried forward + adjustments − reserved −
          taken.
        </p>
      </div>

      <form action={formAction} className="grid max-w-xl gap-4">
        <input type="hidden" name="employeeId" value={employeeId} />

        <div>
          <FieldLabel htmlFor="leaveBalanceId">Leave type</FieldLabel>
          <select
            id="leaveBalanceId"
            name="leaveBalanceId"
            value={selectedBalanceId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedBalanceId(nextId);
              const next = balances.find((row) => row.id === nextId);
              setOpeningBalance(next?.openingBalance ?? "0");
            }}
            className="mt-2 flex h-9 w-full max-w-xs border border-input bg-transparent px-3 text-sm"
          >
            {balances.map((row) => (
              <option key={row.id} value={row.id}>
                {row.leaveTypeName} ({row.leaveTypeCode}) ·{" "}
                {row.availableBalance} available
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="openingBalance">Opening balance (days)</FieldLabel>
          <Input
            id="openingBalance"
            name="openingBalance"
            type="number"
            step="0.01"
            className="mt-2 max-w-xs"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
            required
          />
          {state.fieldErrors?.openingBalance ? (
            <FieldError>{state.fieldErrors.openingBalance}</FieldError>
          ) : (
            <FieldHint>
              Use a negative value when paper remaining is below the system
              entitlement (for example after leave already taken on paper).
            </FieldHint>
          )}
        </div>

        <div>
          <Button type="submit" disabled={pending}>
            <Save />
            {pending ? "Saving…" : "Save opening balance"}
          </Button>
        </div>
      </form>
    </section>
  );
}
