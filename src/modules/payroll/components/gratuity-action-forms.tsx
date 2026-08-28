"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  runGratuityMonthlyAccrualPost,
  type GratuityAccrualFormState,
} from "@/src/modules/payroll/actions/manage-gratuity-accruals";
import {
  approveGratuitySettlement,
  markGratuityTaxRemitted,
  recalculateGratuitySettlement,
  scheduleGratuitySettlement,
  voidGratuitySettlement,
  type GratuitySettlementFormState,
} from "@/src/modules/payroll/actions/manage-gratuity-settlement";
import type { DraftPayRunForGratuity } from "@/src/modules/payroll/data/get-gratuity-settlements";

const idle: GratuitySettlementFormState = {
  status: "idle",
  message: "",
};

const accrualIdle: GratuityAccrualFormState = {
  status: "idle",
  message: "",
};

export function SettlementActionForm({
  action,
  children,
  hidden,
  className,
}: {
  action: (
    prev: GratuitySettlementFormState,
    formData: FormData,
  ) => Promise<GratuitySettlementFormState>;
  children: React.ReactNode;
  hidden: Record<string, string>;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idle);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    } else if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className={className ?? "inline-flex"}>
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

export function UnpaidRowActions({
  row,
  draftPayRuns,
}: {
  row: {
    contractId: string;
    settlementId: string | null;
    status: string;
  };
  draftPayRuns: DraftPayRunForGratuity[];
}) {
  const canApprove =
    row.settlementId != null &&
    (row.status === "CALCULATED" || row.status === "ESTIMATED");
  const canSchedule =
    row.settlementId != null && row.status === "APPROVED";
  const canVoid =
    row.settlementId != null &&
            row.status !== "PAID" &&
            row.status !== "VOID" &&
            row.status !== "PENDING_ESTIMATE";

  return (
    <div className="flex flex-col gap-1.5">
      <SettlementActionForm
        action={recalculateGratuitySettlement}
        hidden={{ contractId: row.contractId }}
      >
        <Button type="submit" size="sm" variant="outline">
          Recalc
        </Button>
      </SettlementActionForm>

      {canApprove && row.settlementId ? (
        <SettlementActionForm
          action={approveGratuitySettlement}
          hidden={{ settlementId: row.settlementId }}
        >
          <Button type="submit" size="sm">
            Approve
          </Button>
        </SettlementActionForm>
      ) : null}

      {canSchedule && row.settlementId ? (
        <SettlementActionForm
          action={scheduleGratuitySettlement}
          hidden={{ settlementId: row.settlementId }}
          className="flex flex-col gap-1"
        >
          <select
            name="payRunId"
            required
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            defaultValue=""
          >
            <option value="" disabled>
              Draft pay run…
            </option>
            {draftPayRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.runNumber} · {run.runKind} · {run.periodName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary">
            Schedule
          </Button>
        </SettlementActionForm>
      ) : null}

      {canVoid && row.settlementId ? (
        <SettlementActionForm
          action={voidGratuitySettlement}
          hidden={{ settlementId: row.settlementId }}
          className="flex flex-col gap-1"
        >
          <Input
            name="reason"
            placeholder="Void reason"
            required
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" variant="destructive">
            Void
          </Button>
        </SettlementActionForm>
      ) : null}
    </div>
  );
}

export function PaidRemitForm({ settlementId }: { settlementId: string }) {
  return (
    <SettlementActionForm
      action={markGratuityTaxRemitted}
      hidden={{ settlementId }}
      className="flex flex-col gap-1"
    >
      <Input
        name="reference"
        placeholder="Remittance ref"
        required
        className="h-8 text-xs"
      />
      <Button type="submit" size="sm" variant="outline">
        Mark remitted
      </Button>
    </SettlementActionForm>
  );
}

export function AccrualPostForm({ canManage }: { canManage: boolean }) {
  const [state, formAction, pending] = useActionState(
    runGratuityMonthlyAccrualPost,
    accrualIdle,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    } else if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  if (!canManage) {
    return null;
  }

  return (
    <form action={formAction}>
      <fieldset disabled={pending} className="contents">
        <Button type="submit" size="sm">
          Post this month&apos;s accruals
        </Button>
      </fieldset>
    </form>
  );
}
