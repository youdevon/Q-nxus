"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  FileText,
  Lock,
  Plus,
  Printer,
  RefreshCw,
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
import {
  addPayrollLineItem,
  deleteDraftPayRun,
  deletePayrollLineItem,
  emailPostedPayslips,
  excludePayslipFromPayRun,
  postPayRun,
  recalculateDraftPayRun,
  reincludePayslipInPayRun,
  type PayRunFormState,
} from "@/src/modules/payroll/actions/manage-pay-run";
import type {
  PayRunDetail,
  PayRunPayslipRow,
} from "@/src/modules/payroll/data/get-pay-runs";
import { PayrollNav } from "./payroll-nav";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

function formatDate(iso: string | null) {
  if (!iso) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
    timeZone: "America/Port_of_Spain",
  }).format(new Date(iso));
}

function formatDateTime(iso: string | null) {
  if (!iso) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Port_of_Spain",
  }).format(new Date(iso));
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

function PayrollLineItemsEditor({
  runId,
  slip,
  canManage,
  isPosted,
}: {
  runId: string;
  slip: PayRunPayslipRow;
  canManage: boolean;
  isPosted: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    addPayrollLineItem,
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

  if (slip.lineItems.length === 0 && (isPosted || !canManage)) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/15 p-3 md:col-span-full">
      {slip.lineItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Run line items
          </p>
          {slip.lineItems.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-medium text-foreground">
                  {line.label}
                </span>{" "}
                <span className="text-muted-foreground">
                  {line.lineType.toLowerCase()} · {line.amount}
                  {line.isTaxable ? " · taxable" : ""}
                  {line.notes ? ` · ${line.notes}` : ""}
                </span>
              </div>
              {canManage && !isPosted ? (
                <RemoveLineItemButton payRunId={runId} lineItemId={line.id} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canManage && !isPosted ? (
        <form action={formAction} className="grid gap-2 md:grid-cols-6">
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
              defaultValue={
                runId && slip.lineItems.length > 0
                  ? "OTHER_EARNING"
                  : "OVERTIME"
              }
            >
              <option value="CORRECTION_EARNING">Correction earning</option>
              <option value="CORRECTION_DEDUCTION">Correction deduction</option>
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
              placeholder="Optional audit note"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={pending}>
              <Plus />
              {pending ? "Adding…" : "Add line"}
            </Button>
          </div>
        </form>
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
}: {
  runId: string;
  slip: PayRunPayslipRow;
  canManage: boolean;
  isPosted: boolean;
}) {
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[1fr_8rem_8rem_8rem_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{slip.employeeName}</p>
          <Badge variant="outline">{slip.employeeNumber}</Badge>
          {slip.isExcluded ? <Badge variant="secondary">Excluded</Badge> : null}
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
        />
      ) : null}
    </div>
  );
}

export function PayRunDetailView({
  run,
  canManage,
}: {
  run: PayRunDetail;
  canManage: boolean;
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

  const isPosted = run.status === "POSTED";
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
                  render={<Link href={`/payroll/runs/${run.id}/bank-export`} />}
                >
                  <FileText />
                  Bank CSV
                </Button>
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
              </>
            ) : null}
            {canManage && !isPosted ? (
              <>
                <RecalculatePayRunButton payRunId={run.id} />
                <DeleteDraftPayRunButton
                  payRunId={run.id}
                  runNumber={run.runNumber}
                  periodName={run.period.name}
                />
                <form action={postAction}>
                  <input type="hidden" name="payRunId" value={run.id} />
                  <Button type="submit" disabled={postPending}>
                    <Lock />
                    {postPending ? "Posting…" : "Post pay run"}
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
            {isPosted ? (
              <Badge variant="success">
                <CircleCheck />
                Posted
              </Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
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
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Posted</p>
          <p className="mt-1 font-medium">{formatDate(run.postedAt)}</p>
        </div>
      </section>

      {!isPosted ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Draft amounts are snapshotted from the payslip preview calculation.
          Use Recalculate to refresh included employees from current contracts
          and statutory configs. Excluded employees stay out of totals and are
          not posted. Posting freezes included payslips so later changes do not
          rewrite history.
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          This run is posted. Included payslip amounts are frozen. Excluded
          employees were not posted and do not appear in official payslip
          history for this run.
        </p>
      )}

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
