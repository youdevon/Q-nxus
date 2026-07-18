"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CircleCheck,
  FileDown,
  FileText,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Undo2,
  UserX,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { payRunStatusBadgeVariant, payslipStatusBadgeVariant } from "@/src/config/ui-colors";
import {
  addPayrollLineItem,
  closePayRun,
  deleteDraftPayRun,
  deletePayrollLineItem,
  emailPostedPayslips,
  excludePayslipFromPayRun,
  postPayRun,
  approveDraftPayRun,
  recalculateDraftPayRun,
  reconcilePayRun,
  reincludePayslipInPayRun,
  type PayRunFormState,
} from "@/src/modules/payroll/actions/manage-pay-run";
import type {
  PayRunDetail,
  PayRunPayslipRow,
} from "@/src/modules/payroll/data/get-pay-runs";
import {
  canApprovePayRun,
  canClosePayRun,
  canPostPayRun,
  canReconcilePayRun,
  isPayRunPosted,
  payRunStatusLabel,
} from "@/src/modules/payroll/lib/pay-run-lifecycle";
import {
  correctionCodeForKind,
  defaultAdjustmentLabel,
  isCorrectionAdjustmentCode,
  isSupplementalPayRunKind,
  type PayrollAdjustmentKind,
} from "@/src/modules/payroll/lib/payroll-adjustment-line";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatMoney,
} from "@/src/lib/format";
import { PayrollNav } from "./payroll-nav";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

function formatDate(iso: string | null) {
  return formatDisplayDate(iso, { fallback: "—" });
}

function formatDateTime(iso: string | null) {
  return formatDisplayDateTime(iso, { fallback: "—" });
}

function RecalculatePayRunButton({ payRunId }: { payRunId: string }) {
  const [state, formAction, pending] = useActionState(
    recalculateDraftPayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={payRunId} />
      <Button type="submit" variant="outline" disabled={pending}>
        <RefreshCw />
        {pending ? "Recalculating…" : "Recalculate"}
      </Button>
    </form>
  );
}

function ApprovePayRunButton({
  payRunId,
  varianceFlagCount,
}: {
  payRunId: string;
  varianceFlagCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    approveDraftPayRun,
    initialState,
  );
  const noteRequired = varianceFlagCount > 0;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <CircleCheck />
        Approve for posting
      </Button>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Approve this pay run?</DialogTitle>
          <DialogDescription>
            {noteRequired ? (
              <>
                This run has {varianceFlagCount} net-pay exception
                {varianceFlagCount === 1 ? "" : "s"} requiring explanation (see
                Exceptions below). Add a note explaining the review before
                approving. A different payroll officer must post this run.
              </>
            ) : (
              "A different payroll officer must post this run once approved."
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="payRunId" value={payRunId} />
          <label className="grid gap-1.5 text-xs" htmlFor="approvalNote">
            <span className="text-muted-foreground">
              Approval note{noteRequired ? " (required)" : " (optional)"}
            </span>
            <Textarea
              id="approvalNote"
              name="approvalNote"
              rows={3}
              required={noteRequired}
              placeholder={
                noteRequired
                  ? "Explain the flagged net-pay variance(s) before approving."
                  : "Optional note for the approval audit trail."
              }
            />
          </label>
          {state.status === "error" ? (
            <p className="text-xs text-destructive">{state.message}</p>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              <CircleCheck />
              {pending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDraftPayRunButton({
  payRunId,
  runNumber,
  periodName,
}: {
  payRunId: string;
  runNumber: string;
  periodName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteDraftPayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Delete draft
      </Button>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete draft pay run?</DialogTitle>
          <DialogDescription>
            This permanently removes draft pay run{" "}
            <span className="font-medium text-foreground">{runNumber}</span>{" "}
            for {periodName}, including all draft payslip membership rows
            (excluded employees included). The pay period will be freed so you
            can create a new run for the same month. Posted payroll cannot be
            deleted this way.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" ? (
          <div
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            {state.message}
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" disabled={pending} />}
          >
            Cancel
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="payRunId" value={payRunId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              <Trash2 />
              {pending ? "Deleting…" : "Delete draft"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailPayslipsButton({ payRunId }: { payRunId: string }) {
  const [state, formAction, pending] = useActionState(
    emailPostedPayslips,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={payRunId} />
      <Button type="submit" variant="outline" disabled={pending}>
        <FileText />
        {pending ? "Queueing…" : "Email payslips"}
      </Button>
    </form>
  );
}

function ReconcilePayRunButton({ payRunId }: { payRunId: string }) {
  const [state, formAction, pending] = useActionState(
    reconcilePayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={payRunId} />
      <Button type="submit" variant="outline" disabled={pending}>
        <ShieldCheck />
        {pending ? "Reconciling…" : "Mark reconciled"}
      </Button>
    </form>
  );
}

function ClosePayRunButton({ payRunId }: { payRunId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    closePayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Archive />
        Close run
      </Button>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Close this pay run?</DialogTitle>
          <DialogDescription>
            Closing is terminal — no further payment or reopen is possible
            without creating a new correction or off-cycle run.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" disabled={pending} />}
          >
            Cancel
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="payRunId" value={payRunId} />
            <Button type="submit" disabled={pending}>
              <Archive />
              {pending ? "Closing…" : "Close run"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExcludePayslipControls({
  runId,
  slip,
}: {
  runId: string;
  slip: PayRunPayslipRow;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    excludePayslipFromPayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <UserX />
        Exclude
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full min-w-[16rem] flex-col gap-2 md:col-span-full"
    >
      <input type="hidden" name="payRunId" value={runId} />
      <input type="hidden" name="payslipId" value={slip.id} />
      <label
        className="text-xs text-muted-foreground"
        htmlFor={`reason-${slip.id}`}
      >
        Exclusion reason (required)
      </label>
      <Textarea
        id={`reason-${slip.id}`}
        name="exclusionReason"
        rows={2}
        required
        placeholder="Why is this employee excluded from this pay run?"
        aria-invalid={Boolean(state.fieldErrors?.exclusionReason)}
      />
      {state.fieldErrors?.exclusionReason ? (
        <p className="text-xs text-destructive">
          {state.fieldErrors.exclusionReason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <UserX />
          {pending ? "Excluding…" : "Confirm exclude"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReincludePayslipButton({
  runId,
  slip,
}: {
  runId: string;
  slip: PayRunPayslipRow;
}) {
  const [state, formAction, pending] = useActionState(
    reincludePayslipInPayRun,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={runId} />
      <input type="hidden" name="payslipId" value={slip.id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Undo2 />
        {pending ? "Re-including…" : "Re-include"}
      </Button>
    </form>
  );
}

function RemoveLineItemButton({
  payRunId,
  lineItemId,
}: {
  payRunId: string;
  lineItemId: string;
}) {
  const [state, formAction, pending] = useActionState(
    deletePayrollLineItem,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="payRunId" value={payRunId} />
      <input type="hidden" name="lineItemId" value={lineItemId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        <Trash2 />
        Remove
      </Button>
    </form>
  );
}

function LineItemRow({
  runId,
  line,
  canManage,
  isPosted,
}: {
  runId: string;
  line: PayRunPayslipRow["lineItems"][number];
  canManage: boolean;
  isPosted: boolean;
}) {
  const isAdjustment = isCorrectionAdjustmentCode(line.code);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {isAdjustment ? <Badge variant="outline">Adjustment</Badge> : null}
          <span className="font-medium text-foreground">{line.label}</span>
        </div>
        <p className="mt-0.5 text-muted-foreground">
          {line.lineType.toLowerCase()} · {line.amount}
          {line.isTaxable ? " · taxable" : ""}
          {line.notes ? ` · ${line.notes}` : ""}
        </p>
      </div>
      {canManage && !isPosted ? (
        <RemoveLineItemButton payRunId={runId} lineItemId={line.id} />
      ) : null}
    </div>
  );
}

function AddAdjustmentPanel({
  runId,
  slip,
  currency,
}: {
  runId: string;
  slip: PayRunPayslipRow;
  currency: string;
}) {
  const [kind, setKind] = useState<PayrollAdjustmentKind>("EARNING");
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    addPayrollLineItem,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(
        state.fieldErrors?.notes ||
          state.fieldErrors?.amount ||
          state.message,
      );
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      setFormKey((key) => key + 1);
      setKind("EARNING");
    }
  }, [state]);

  return (
    <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Add adjustment
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Adds a one-off amount on this run. The original posted payslip is not
          changed.
        </p>
      </div>

      <form
        key={formKey}
        action={formAction}
        className="grid gap-2 md:grid-cols-6"
      >
        <input type="hidden" name="payRunId" value={runId} />
        <input type="hidden" name="payslipId" value={slip.id} />
        <input type="hidden" name="lineType" value={kind} />
        <input type="hidden" name="code" value={correctionCodeForKind(kind)} />
        <input type="hidden" name="label" value={defaultAdjustmentLabel(kind)} />

        <fieldset className="grid gap-1 text-xs md:col-span-2">
          <legend className="text-muted-foreground">Type</legend>
          <div className="flex h-9 flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="adjustmentKind"
                checked={kind === "EARNING"}
                onChange={() => setKind("EARNING")}
              />
              Earning (pay more)
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="adjustmentKind"
                checked={kind === "DEDUCTION"}
                onChange={() => setKind("DEDUCTION")}
              />
              Deduction (recover)
            </label>
          </div>
          {state.fieldErrors?.lineType ? (
            <p className="text-destructive">{state.fieldErrors.lineType}</p>
          ) : null}
        </fieldset>

        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Amount ({currency})</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            className="h-9 rounded-md border border-input bg-background px-2"
            placeholder="0.00"
            required
            aria-invalid={Boolean(state.fieldErrors?.amount)}
          />
          {state.fieldErrors?.amount ? (
            <p className="text-destructive">{state.fieldErrors.amount}</p>
          ) : null}
        </label>

        <label className="grid gap-1 text-xs md:col-span-2">
          <span className="text-muted-foreground">Reason</span>
          <input
            name="notes"
            className="h-9 rounded-md border border-input bg-background px-2"
            placeholder="Why is this adjustment needed?"
            required
            aria-invalid={Boolean(state.fieldErrors?.notes)}
          />
          {state.fieldErrors?.notes ? (
            <p className="text-destructive">{state.fieldErrors.notes}</p>
          ) : null}
        </label>

        {kind === "EARNING" ? (
          <label className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <input name="isTaxable" type="checkbox" defaultChecked />
            Taxable earning
          </label>
        ) : (
          <div className="hidden md:block" aria-hidden />
        )}

        <div className="flex items-end md:col-span-6">
          <Button type="submit" size="sm" disabled={pending}>
            <Plus />
            {pending ? "Adding…" : "Add adjustment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AdvancedLineItemsForm({
  runId,
  slip,
  includeCorrectionCodes,
}: {
  runId: string;
  slip: PayRunPayslipRow;
  includeCorrectionCodes: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    addPayrollLineItem,
    initialState,
  );
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      setFormKey((key) => key + 1);
    }
  }, [state]);

  return (
    <form
      key={formKey}
      action={formAction}
      className="grid gap-2 md:grid-cols-6"
    >
      <input type="hidden" name="payRunId" value={runId} />
      <input type="hidden" name="payslipId" value={slip.id} />
      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground">Type</span>
        <select
          name="lineType"
          className="h-9 rounded-md border border-input bg-background px-2"
          defaultValue="EARNING"
        >
          <option value="EARNING">Earning</option>
          <option value="DEDUCTION">Deduction</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground">Code</span>
        <select
          name="code"
          className="h-9 rounded-md border border-input bg-background px-2"
          defaultValue="OVERTIME"
        >
          {includeCorrectionCodes ? (
            <>
              <option value="CORRECTION_EARNING">Correction earning</option>
              <option value="CORRECTION_DEDUCTION">Correction deduction</option>
            </>
          ) : null}
          <option value="OVERTIME">Overtime</option>
          <option value="BONUS">Bonus</option>
          <option value="COMMISSION">Commission</option>
          <option value="OTHER_EARNING">Other earning</option>
          <option value="OTHER_DEDUCTION">Other deduction</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs md:col-span-2">
        <span className="text-muted-foreground">Label</span>
        <input
          name="label"
          className="h-9 rounded-md border border-input bg-background px-2"
          placeholder="e.g. July overtime"
          required
        />
      </label>
      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground">Amount</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          className="h-9 rounded-md border border-input bg-background px-2"
          placeholder="0.00"
          required
        />
      </label>
      <label className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <input name="isTaxable" type="checkbox" defaultChecked />
        Taxable earning
      </label>
      <label className="grid gap-1 text-xs md:col-span-5">
        <span className="text-muted-foreground">Notes</span>
        <input
          name="notes"
          className="h-9 rounded-md border border-input bg-background px-2"
          placeholder={
            includeCorrectionCodes
              ? "Required for correction codes"
              : "Optional audit note"
          }
        />
      </label>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>
          <Plus />
          {pending ? "Adding…" : "Add line"}
        </Button>
      </div>
    </form>
  );
}

function PayrollLineItemsEditor({
  runId,
  slip,
  canManage,
  isPosted,
  runKind,
  currency,
}: {
  runId: string;
  slip: PayRunPayslipRow;
  canManage: boolean;
  isPosted: boolean;
  runKind: PayRunDetail["runKind"];
  currency: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isSupplemental = isSupplementalPayRunKind(runKind);
  const adjustmentLines = slip.lineItems.filter((line) =>
    isCorrectionAdjustmentCode(line.code),
  );
  const otherLines = slip.lineItems.filter(
    (line) => !isCorrectionAdjustmentCode(line.code),
  );

  if (
    slip.lineItems.length === 0 &&
    (isPosted || !canManage)
  ) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/15 p-3 md:col-span-full">
      {adjustmentLines.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Adjustments
          </p>
          {adjustmentLines.map((line) => (
            <LineItemRow
              key={line.id}
              runId={runId}
              line={line}
              canManage={canManage}
              isPosted={isPosted}
            />
          ))}
        </div>
      ) : null}

      {otherLines.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isSupplemental ? "Other line items" : "Run line items"}
          </p>
          {otherLines.map((line) => (
            <LineItemRow
              key={line.id}
              runId={runId}
              line={line}
              canManage={canManage}
              isPosted={isPosted}
            />
          ))}
        </div>
      ) : null}

      {canManage && !isPosted && isSupplemental ? (
        <AddAdjustmentPanel runId={runId} slip={slip} currency={currency} />
      ) : null}

      {canManage && !isPosted ? (
        isSupplemental ? (
          <div className="space-y-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAdvanced((open) => !open)}
            >
              <Plus />
              {showAdvanced
                ? "Hide other line types"
                : "Add overtime, bonus, or other line"}
            </Button>
            {showAdvanced ? (
              <AdvancedLineItemsForm
                runId={runId}
                slip={slip}
                includeCorrectionCodes={false}
              />
            ) : null}
          </div>
        ) : (
          <AdvancedLineItemsForm
            runId={runId}
            slip={slip}
            includeCorrectionCodes
          />
        )
      ) : null}
    </div>
  );
}

function CorrectionDeltaPanel({
  comparison,
}: {
  comparison: NonNullable<PayRunPayslipRow["comparison"]>;
}) {
  const netToneClass =
    comparison.netDirection === "increase"
      ? "text-emerald-600 dark:text-emerald-400"
      : comparison.netDirection === "decrease"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 md:col-span-full">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Correction delta vs {comparison.sourceLabel}
      </p>
      <div className="grid grid-cols-[6rem_1fr_1fr_1fr] gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground" />
        <span className="text-muted-foreground">Gross</span>
        <span className="text-muted-foreground">Deductions</span>
        <span className="text-muted-foreground">Net</span>

        <span className="text-muted-foreground">Original</span>
        <span>{comparison.original.grossPay}</span>
        <span>{comparison.original.totalDeductions}</span>
        <span>{comparison.original.netPay}</span>

        <span className="text-muted-foreground">This run</span>
        <span>{comparison.correction.grossPay}</span>
        <span>{comparison.correction.totalDeductions}</span>
        <span>{comparison.correction.netPay}</span>

        <span className="font-medium text-foreground">Difference</span>
        <span className="font-medium">{comparison.delta.grossPay}</span>
        <span className="font-medium">{comparison.delta.totalDeductions}</span>
        <span className={`font-medium ${netToneClass}`}>
          {comparison.delta.netPay}
        </span>
      </div>
    </div>
  );
}

function PayslipRow({
  runId,
  slip,
  canManage,
  isPosted,
  runKind,
  currency,
}: {
  runId: string;
  slip: PayRunPayslipRow;
  canManage: boolean;
  isPosted: boolean;
  runKind: PayRunDetail["runKind"];
  currency: string;
}) {
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[1fr_8rem_8rem_8rem_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{slip.employeeName}</p>
          <Badge variant="outline">{slip.employeeNumber}</Badge>
          {slip.isExcluded ? (
            <Badge variant={payslipStatusBadgeVariant("EXCLUDED")}>
              Excluded
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {[slip.jobTitle, slip.departmentName].filter(Boolean).join(" · ") ||
            "—"}
        </p>
        {slip.isExcluded ? (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Reason:</span>{" "}
              {slip.exclusionReason || "—"}
            </p>
            <p>
              {slip.excludedByName
                ? `Excluded by ${slip.excludedByName}`
                : "Excluded"}
              {slip.excludedAt ? ` · ${formatDateTime(slip.excludedAt)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
      {!slip.isExcluded ? (
        <>
          <div>
            <p className="text-xs text-muted-foreground">Gross</p>
            <p className="text-sm font-medium">{slip.grossPay}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deductions</p>
            <p className="text-sm font-medium">{slip.totalDeductions}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="text-sm font-medium">{slip.netPay}</p>
          </div>
        </>
      ) : (
        <div className="md:col-span-3">
          <p className="text-xs text-muted-foreground">
            Not included in run totals or posted payslips.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {!slip.isExcluded ? (
          <>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href={slip.viewHref} />}
            >
              <FileText />
              View
            </Button>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href={slip.printHref} />}
            >
              <Printer />
              Print
            </Button>
            {isPosted ? (
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href={`${slip.viewHref}/pdf`} />}
              >
                <FileDown />
                PDF
              </Button>
            ) : null}
            {canManage && !isPosted ? (
              <ExcludePayslipControls runId={runId} slip={slip} />
            ) : null}
          </>
        ) : canManage && !isPosted ? (
          <ReincludePayslipButton runId={runId} slip={slip} />
        ) : null}
      </div>
      {!slip.isExcluded && slip.comparison ? (
        <CorrectionDeltaPanel comparison={slip.comparison} />
      ) : null}
      {!slip.isExcluded ? (
        <PayrollLineItemsEditor
          runId={runId}
          slip={slip}
          canManage={canManage}
          isPosted={isPosted}
          runKind={runKind}
          currency={currency}
        />
      ) : null}
    </div>
  );
}

function reasonLabel(reason: PayRunDetail["varianceFlags"][number]["reason"]) {
  switch (reason) {
    case "NEW":
      return "New pay";
    case "ABSOLUTE":
      return "Large change";
    case "RELATIVE":
      return "Large % change";
    default:
      return reason;
  }
}

function ExceptionsPanel({
  flags,
  currency,
}: {
  flags: PayRunDetail["varianceFlags"];
  currency: string;
}) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        <SectionHeading>
          Exceptions ({flags.length})
        </SectionHeading>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Net pay changed materially vs this employee&apos;s last posted period.
        Review before approving — add context in the approval note.
      </p>
      <div className="divide-y divide-border/70 rounded-lg border border-amber-500/40 bg-amber-500/5">
        {flags.map((flag) => (
          <div
            key={flag.employeeId}
            className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_7rem_7rem_7rem_auto]"
          >
            <p className="font-medium">{flag.employeeName}</p>
            <div>
              <p className="text-xs text-muted-foreground">Prior net</p>
              <p className="tabular-nums">
                {formatMoney(flag.priorNet, { currency })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current net</p>
              <p className="tabular-nums">
                {formatMoney(flag.currentNet, { currency })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delta</p>
              <p className="tabular-nums font-medium">
                {flag.deltaNet >= 0 ? "+" : ""}
                {formatMoney(flag.deltaNet, { currency })}
              </p>
            </div>
            <div className="flex items-center md:justify-end">
              <Badge variant="warning">{reasonLabel(flag.reason)}</Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PayRunDetailView({
  run,
  canManage,
  paymentSummary = null,
}: {
  run: PayRunDetail;
  canManage: boolean;
  paymentSummary?: {
    prepared: boolean;
    paymentCount: number;
    readyCount: number;
    batchCount: number;
    latestBatchStatus: string | null;
  } | null;
}) {
  const [postState, postAction, postPending] = useActionState(
    postPayRun,
    initialState,
  );

  useEffect(() => {
    if (postState.status === "error") {
      toast.error(postState.message);
    }
  }, [postState]);

  const isPosted = isPayRunPosted(run.status);
  const isSupplemental = isSupplementalPayRunKind(run.runKind);
  const unexplainedVarianceCount = run.varianceFlags.length;
  const included = run.payslips.filter((slip) => !slip.isExcluded);
  const excluded = run.payslips.filter((slip) => slip.isExcluded);
  const kindSuffix =
    run.runKind === "CORRECTION"
      ? " · Correction"
      : run.runKind === "OFF_CYCLE"
        ? " · Off-cycle"
        : "";
  const employeeSummary =
    run.excludedCount > 0
      ? `${run.period.name}${kindSuffix} · ${run.employeeCount} included · ${run.excludedCount} excluded`
      : `${run.period.name}${kindSuffix} · ${run.employeeCount} employees`;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title={`Pay run ${run.runNumber}`}
        description={employeeSummary}
        backHref="/payroll/runs"
        backLabel="Pay runs"
        actions={
          <PageActionsEnd>
            {isPosted ? (
              <>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/payroll/runs/${run.id}/print`} />}
                >
                  <Printer />
                  Batch print
                </Button>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/payroll/runs/${run.id}/pdf`} />}
                >
                  <FileDown />
                  Download all PDFs
                </Button>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/payroll/runs/${run.id}/payments`} />}
                >
                  <Wallet />
                  {paymentSummary?.prepared
                    ? `Payments (${paymentSummary.readyCount}/${paymentSummary.paymentCount})`
                    : "Prepare payments"}
                </Button>
                {canManage ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={
                      <Link href={`/payroll/runs/${run.id}/bank-export`} />
                    }
                  >
                    <FileText />
                    Bank CSV
                  </Button>
                ) : null}
                {canManage ? <EmailPayslipsButton payRunId={run.id} /> : null}
                {canManage ? (
                  <>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      render={<Link href={`/payroll/runs/${run.id}/gl-export`} />}
                    >
                      <FileText />
                      GL CSV
                    </Button>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      render={
                        <Link href={`/payroll/runs/${run.id}/supplemental`} />
                      }
                    >
                      Correction / off-cycle
                    </Button>
                  </>
                ) : null}
                {canManage && canReconcilePayRun(run.status) ? (
                  <ReconcilePayRunButton payRunId={run.id} />
                ) : null}
                {canManage && canClosePayRun(run.status) ? (
                  <ClosePayRunButton payRunId={run.id} />
                ) : null}
              </>
            ) : null}
            {canManage && !isPosted ? (
              <>
                <RecalculatePayRunButton payRunId={run.id} />
                {canApprovePayRun(run.status) ? (
                  <ApprovePayRunButton
                    payRunId={run.id}
                    varianceFlagCount={unexplainedVarianceCount}
                  />
                ) : null}
                <DeleteDraftPayRunButton
                  payRunId={run.id}
                  runNumber={run.runNumber}
                  periodName={run.period.name}
                />
                <form action={postAction}>
                  <input type="hidden" name="payRunId" value={run.id} />
                  <Button
                    type="submit"
                    disabled={postPending || !canPostPayRun(run.status)}
                  >
                    <Lock />
                    {postPending
                      ? "Posting…"
                      : run.status === "APPROVED"
                        ? "Post pay run"
                        : "Post (needs approval)"}
                  </Button>
                </form>
              </>
            ) : null}
          </PageActionsEnd>
        }
      />

      {postState.status === "error" ? (
        <div
          role="alert"
          className="mb-4 whitespace-pre-line border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
        >
          {postState.message}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant={payRunStatusBadgeVariant(run.status)}>
              {isPosted ? (
                <>
                  <CircleCheck />
                  {payRunStatusLabel(run.status)}
                </>
              ) : (
                payRunStatusLabel(run.status)
              )}
            </Badge>
            {run.runKind !== "REGULAR" ? (
              <Badge variant="outline">
                {run.runKind === "CORRECTION" ? "Correction" : "Off-cycle"}
              </Badge>
            ) : null}
          </div>
          {run.sourceRunNumber ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sourced from {run.sourceRunNumber}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gross</p>
          <p className="mt-1 text-lg font-semibold">{run.totalGross}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deductions</p>
          <p className="mt-1 text-lg font-semibold">{run.totalDeductions}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Net</p>
          <p className="mt-1 text-lg font-semibold">{run.totalNet}</p>
        </div>
      </section>

      {isPosted ? (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border/60 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Payments</span>
            {paymentSummary?.prepared ? (
              <>
                <Badge variant="success">
                  {paymentSummary.readyCount}/{paymentSummary.paymentCount} ready
                </Badge>
                {paymentSummary.batchCount > 0 ? (
                  <Badge variant="outline">
                    {paymentSummary.batchCount} batch
                    {paymentSummary.batchCount === 1 ? "" : "es"}
                    {paymentSummary.latestBatchStatus
                      ? ` · ${paymentSummary.latestBatchStatus}`
                      : ""}
                  </Badge>
                ) : (
                  <Badge variant="warning">No batch yet</Badge>
                )}
              </>
            ) : (
              <Badge variant="warning">Not prepared</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!paymentSummary?.prepared ? (
              <p className="max-w-md text-xs text-muted-foreground">
                Pay run is posted. Open payments to prepare disbursement
                snapshots, then use Manual register or Bank CSV. Enable ACH only
                after the bank confirms the export layout.
              </p>
            ) : null}
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href={`/payroll/runs/${run.id}/payments`} />}
            >
              <Wallet />
              {paymentSummary?.prepared ? "Open payments" : "Prepare payments"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="mt-1 font-medium">{run.period.name}</p>
          <p className="text-xs text-muted-foreground">
            {run.period.periodStart} → {run.period.periodEnd}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 font-medium">{formatDate(run.createdAt)}</p>
          {run.createdByName ? (
            <p className="text-xs text-muted-foreground">by {run.createdByName}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Posted</p>
          <p className="mt-1 font-medium">{formatDate(run.postedAt)}</p>
          {run.postedByName ? (
            <p className="text-xs text-muted-foreground">by {run.postedByName}</p>
          ) : null}
        </div>
      </section>

      {run.lastRecalc || run.exports.length > 0 ? (
        <section className="mt-6 grid gap-4 text-sm md:grid-cols-3">
          {run.lastRecalc ? (
            <div>
              <p className="text-xs text-muted-foreground">Last recalculated</p>
              <p className="mt-1 font-medium">
                {formatDateTime(run.lastRecalc.at)}
              </p>
              {run.lastRecalc.byName ? (
                <p className="text-xs text-muted-foreground">
                  by {run.lastRecalc.byName}
                </p>
              ) : null}
            </div>
          ) : null}
          {run.exports.length > 0 ? (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">Export history</p>
              <ul className="mt-1 space-y-0.5">
                {run.exports.map((entry, index) => (
                  <li
                    key={`${entry.kind}-${entry.at}-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {entry.label}
                    </span>{" "}
                    · {formatDateTime(entry.at)}
                    {entry.byName ? ` · ${entry.byName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {!isPosted ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {isSupplemental ? (
            <>
              This {run.runKind === "CORRECTION" ? "correction" : "off-cycle"}{" "}
              draft creates its own payslips — the original posted payslip is
              not changed. Use <span className="font-medium text-foreground">Add adjustment</span>{" "}
              for one-off earning or deduction deltas, then Recalculate if
              needed. Posting freezes included payslips so later changes do not
              rewrite history.
            </>
          ) : (
            <>
              Draft amounts are snapshotted from the payslip preview calculation.
              Use Recalculate to refresh included employees from current contracts
              and statutory configs. Excluded employees stay out of totals and are
              not posted. Posting freezes included payslips so later changes do not
              rewrite history.
            </>
          )}
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          This run is posted. Included payslip amounts are frozen. Excluded
          employees were not posted and do not appear in official payslip
          history for this run.
        </p>
      )}

      <ExceptionsPanel flags={run.varianceFlags} currency={run.currency} />

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <SectionHeading>Payslips</SectionHeading>
        </div>

        {included.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No included employees in this run.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {included.map((slip) => (
              <PayslipRow
                key={slip.id}
                runId={run.id}
                slip={slip}
                canManage={canManage}
                isPosted={isPosted}
                runKind={run.runKind}
                currency={run.currency}
              />
            ))}
          </div>
        )}
      </section>

      {excluded.length > 0 ? (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <UserX className="size-4 text-muted-foreground" />
            <SectionHeading>Excluded from this run</SectionHeading>
          </div>
          <div className="divide-y divide-border/70">
            {excluded.map((slip) => (
              <PayslipRow
                key={slip.id}
                runId={run.id}
                slip={slip}
                canManage={canManage}
                isPosted={isPosted}
                runKind={run.runKind}
                currency={run.currency}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isPosted ? (
        <section className="mt-10 rounded-lg border border-border/70 bg-muted/15 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">GL export mapping</p>
          <p className="mt-1">
            5000 Salary expense (debit gross), 5050 Employer NIS expense
            (debit employer NIS), 2100 Net payroll payable, 2110 PAYE payable,
            2120 NIS payable, 2130 Health surcharge payable. This is a default
            chart-of-accounts stub for review before import.
          </p>
        </section>
      ) : null}
    </PageShell>
  );
}
