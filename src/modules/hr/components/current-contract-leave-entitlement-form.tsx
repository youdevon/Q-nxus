"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, FieldLabel } from "@/src/components/ui/field";
import {
  updateCurrentContractLeaveEntitlements,
  type ContractLeaveEntitlementFormState,
} from "@/src/modules/hr/actions/update-contract-leave-entitlements";
import { formatLeaveOverrideDays } from "@/src/modules/hr/lib/contract-leave-overrides";

const initialState: ContractLeaveEntitlementFormState = {
  status: "idle",
  message: "",
};

export type CurrentContractLeaveEntitlementEditorData = {
  employeeId: string;
  contractId: string;
  contractNumber: string | null;
  vacationLeaveDaysOverride: string | null;
  sickLeaveDaysOverride: string | null;
};

export function CurrentContractLeaveEntitlementForm({
  contract,
}: {
  contract: CurrentContractLeaveEntitlementEditorData;
}) {
  const [state, formAction, pending] = useActionState(
    updateCurrentContractLeaveEntitlements,
    initialState,
  );

  const initialVacation =
    contract.vacationLeaveDaysOverride != null
      ? formatLeaveOverrideDays(contract.vacationLeaveDaysOverride)
      : "";
  const initialVacationEnabled =
    contract.vacationLeaveDaysOverride == null
      ? true
      : Number(contract.vacationLeaveDaysOverride) > 0;

  const initialSick =
    contract.sickLeaveDaysOverride != null
      ? formatLeaveOverrideDays(contract.sickLeaveDaysOverride)
      : "";
  const initialSickEnabled =
    contract.sickLeaveDaysOverride == null
      ? true
      : Number(contract.sickLeaveDaysOverride) > 0;

  const [vacationLeaveEnabled, setVacationLeaveEnabled] = useState(
    initialVacationEnabled,
  );
  const [vacationLeaveDays, setVacationLeaveDays] = useState(initialVacation);
  const [sickLeaveEnabled, setSickLeaveEnabled] = useState(initialSickEnabled);
  const [sickLeaveDays, setSickLeaveDays] = useState(initialSick);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Adjust vacation & sick entitlement
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Updates the current contract
          {contract.contractNumber ? ` (${contract.contractNumber})` : ""} and
          recalculates leave balances. Taken and reserved days are preserved.
        </p>
      </div>

      <form action={formAction} className="grid max-w-xl gap-4">
        <input type="hidden" name="employeeId" value={contract.employeeId} />
        <input type="hidden" name="contractId" value={contract.contractId} />

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="vacationLeaveEnabled"
            checked={vacationLeaveEnabled}
            onChange={(event) => setVacationLeaveEnabled(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            <span className="block text-sm font-medium">
              Include vacation leave
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Uncheck for people with no vacation entitlement on this contract.
            </span>
          </span>
        </label>

        {vacationLeaveEnabled ? (
          <div>
            <FieldLabel htmlFor="vacationLeaveDays">
              Vacation leave (days)
            </FieldLabel>
            <Input
              id="vacationLeaveDays"
              name="vacationLeaveDays"
              type="number"
              min="0"
              step="0.01"
              className="mt-2 max-w-xs"
              value={vacationLeaveDays}
              onChange={(event) => setVacationLeaveDays(event.target.value)}
              required
            />
            {state.fieldErrors?.vacationLeaveDays ? (
              <FieldError>{state.fieldErrors.vacationLeaveDays}</FieldError>
            ) : (
              <FieldHint>
                Absolute days for this contract period (not an annual rate).
              </FieldHint>
            )}
          </div>
        ) : (
          <input type="hidden" name="vacationLeaveDays" value="0" />
        )}

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="sickLeaveEnabled"
            checked={sickLeaveEnabled}
            onChange={(event) => setSickLeaveEnabled(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            <span className="block text-sm font-medium">Include sick leave</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Uncheck for people with no sick leave entitlement on this
              contract.
            </span>
          </span>
        </label>

        {sickLeaveEnabled ? (
          <div>
            <FieldLabel htmlFor="sickLeaveDays">Sick leave (days)</FieldLabel>
            <Input
              id="sickLeaveDays"
              name="sickLeaveDays"
              type="number"
              min="0"
              step="0.01"
              className="mt-2 max-w-xs"
              value={sickLeaveDays}
              onChange={(event) => setSickLeaveDays(event.target.value)}
              required
            />
            {state.fieldErrors?.sickLeaveDays ? (
              <FieldError>{state.fieldErrors.sickLeaveDays}</FieldError>
            ) : (
              <FieldHint>
                Absolute days for this contract period (not an annual rate).
              </FieldHint>
            )}
          </div>
        ) : (
          <input type="hidden" name="sickLeaveDays" value="0" />
        )}

        <div>
          <Button type="submit" disabled={pending}>
            <Save />
            {pending ? "Saving…" : "Save entitlements"}
          </Button>
        </div>
      </form>
    </section>
  );
}
