"use client";

import { useActionState, useEffect } from "react";
import { Check, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  decideStatutoryOverride,
  requestStatutoryOverride,
  submitStatutoryOverrideForApproval,
  type StatutoryOverrideFormState,
} from "@/src/modules/payroll/actions/manage-statutory-overrides";
import { formatMoney } from "@/src/lib/format";

const requestInitial: StatutoryOverrideFormState = {
  status: "idle",
  message: "",
};

const decideInitial: StatutoryOverrideFormState = {
  status: "idle",
  message: "",
};

type OverrideRow = {
  id: string;
  taxYear: number;
  periodEnd: string;
  payeAmount: string | null;
  nisEmployeeAmount: string | null;
  healthSurchargeAmount: string | null;
  reason: string;
  status: string;
  rejectedReason: string | null;
  updatedAt: string;
};

function statusVariant(
  status: string,
): "secondary" | "warning" | "success" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
    case "APPLIED":
      return "success";
    case "PENDING_APPROVAL":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "destructive";
    default:
      return "secondary";
  }
}

function RequestOverrideForm({
  employeeId,
  canRequest,
}: {
  employeeId: string;
  canRequest: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestStatutoryOverride,
    requestInitial,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  if (!canRequest) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-2"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="space-y-1.5 md:col-span-2">
        <p className="text-sm font-medium">Request period override</p>
        <p className="text-xs text-muted-foreground">
          Maker-checker: save a draft or submit for approval. Amounts replace
          calculated PAYE / NIS / Health for that period end.
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="periodEnd">
          Period end
        </label>
        <Input id="periodEnd" name="periodEnd" type="date" required />
        {state.fieldErrors?.periodEnd ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.periodEnd}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="payeAmount">
          PAYE amount
        </label>
        <Input
          id="payeAmount"
          name="payeAmount"
          inputMode="decimal"
          placeholder="Optional"
        />
        {state.fieldErrors?.payeAmount ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.payeAmount}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="nisEmployeeAmount"
        >
          NIS (employee)
        </label>
        <Input
          id="nisEmployeeAmount"
          name="nisEmployeeAmount"
          inputMode="decimal"
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1.5">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="healthSurchargeAmount"
        >
          Health surcharge
        </label>
        <Input
          id="healthSurchargeAmount"
          name="healthSurchargeAmount"
          inputMode="decimal"
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <label className="text-xs text-muted-foreground" htmlFor="reason">
          Reason
        </label>
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          required
          placeholder="IRD instruction / correction detail"
        />
        {state.fieldErrors?.reason ? (
          <p className="text-xs text-destructive">{state.fieldErrors.reason}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="submitForApproval"
            defaultChecked
          />
          Submit for approval (notifies approvers)
        </label>
        <Button type="submit" disabled={pending} size="sm">
          <Save className="size-4" />
          {pending ? "Saving…" : "Save override"}
        </Button>
      </div>
    </form>
  );
}

function SubmitDraftOverrideForm({
  overrideId,
  canRequest,
}: {
  overrideId: string;
  canRequest: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    submitStatutoryOverrideForApproval,
    decideInitial,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  if (!canRequest) {
    return null;
  }

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="overrideId" value={overrideId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Submitting…" : "Submit for approval"}
      </Button>
    </form>
  );
}

function DecideOverrideForm({
  overrideId,
  canDecide,
}: {
  overrideId: string;
  canDecide: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    decideStatutoryOverride,
    decideInitial,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  if (!canDecide) {
    return null;
  }

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="overrideId" value={overrideId} />
      <div className="min-w-[12rem] flex-1 space-y-1">
        <label
          className="text-xs text-muted-foreground"
          htmlFor={`rejectedReason-${overrideId}`}
        >
          Reject reason (if rejecting)
        </label>
        <Input
          id={`rejectedReason-${overrideId}`}
          name="rejectedReason"
          placeholder="Optional"
        />
      </div>
      <Button
        type="submit"
        name="decision"
        value="approve"
        size="sm"
        disabled={pending}
      >
        <Check className="size-4" />
        Approve
      </Button>
      <Button
        type="submit"
        name="decision"
        value="reject"
        size="sm"
        variant="outline"
        disabled={pending}
      >
        <X className="size-4" />
        Reject
      </Button>
    </form>
  );
}

export function EmployeeStatutoryOverridesPanel({
  employeeId,
  overrides,
  canRequest,
  canDecide,
  currency = "TTD",
}: {
  employeeId: string;
  overrides: OverrideRow[];
  canRequest: boolean;
  canDecide: boolean;
  currency?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <SectionHeading>Statutory overrides</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Period-level PAYE / NIS / Health amount overrides with maker-checker
          approval.
        </p>
      </div>

      <RequestOverrideForm employeeId={employeeId} canRequest={canRequest} />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Period end</th>
              <th className="px-3 py-2 font-medium">PAYE</th>
              <th className="px-3 py-2 font-medium">NIS</th>
              <th className="px-3 py-2 font-medium">Health</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {overrides.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No overrides for this tax year.
                </td>
              </tr>
            ) : (
              overrides.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-3 tabular-nums">{row.periodEnd}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.payeAmount != null
                      ? formatMoney(Number(row.payeAmount), { currency })
                      : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.nisEmployeeAmount != null
                      ? formatMoney(Number(row.nisEmployeeAmount), {
                          currency,
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.healthSurchargeAmount != null
                      ? formatMoney(Number(row.healthSurchargeAmount), {
                          currency,
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusVariant(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                    {row.status === "DRAFT" ? (
                      <SubmitDraftOverrideForm
                        overrideId={row.id}
                        canRequest={canRequest}
                      />
                    ) : null}
                    {row.status === "PENDING_APPROVAL" ? (
                      <DecideOverrideForm
                        overrideId={row.id}
                        canDecide={canDecide}
                      />
                    ) : null}
                    {row.rejectedReason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.rejectedReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
