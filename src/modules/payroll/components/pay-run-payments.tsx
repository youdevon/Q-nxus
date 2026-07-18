"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  approvePayRunPaymentBatch,
  createPayRunPaymentBatch,
  generatePayRunPaymentBatchFile,
  markPayRunAllocationReturned,
  preparePayRunPayments,
  regeneratePayRunAllocation,
  resolvePayRunAllocation,
  type PayrollPaymentActionState,
} from "@/src/modules/payroll/actions/manage-payroll-payments";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import type {
  AchPaymentBatchDetailData,
  PayRunPaymentsPageData,
} from "@/src/modules/payroll/data/get-payroll-payments";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";

const idle: PayrollPaymentActionState = { status: "idle", message: "" };

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" {
  switch (status) {
    case "READY":
    case "APPROVED":
    case "GENERATED":
    case "EXPORTED":
    case "PAID":
    case "RESOLVED":
      return "success";
    case "PAYMENT_SETUP_REQUIRED":
    case "PENDING_APPROVAL":
    case "DRAFT":
    case "PENDING":
    case "RETURNED":
    case "REJECTED":
      return "warning";
    case "PAYMENT_SETUP_ERROR":
    case "CANCELLED":
    case "FAILED":
      return "destructive";
    case "NOT_CONFIGURED":
      return "secondary";
    default:
      return "outline";
  }
}

function PaymentActionForm({
  action,
  children,
  hidden,
}: {
  action: (
    prev: PayrollPaymentActionState,
    formData: FormData,
  ) => Promise<PayrollPaymentActionState>;
  children: React.ReactNode;
  hidden: Record<string, string>;
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
    <form action={formAction} className="inline-flex">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

export function PayRunPaymentsView({
  data,
  canManage,
}: {
  data: PayRunPaymentsPageData;
  canManage: boolean;
}) {
  const { paymentSummary, flags } = data;
  const isPosted = isPayRunPosted(data.status);

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title={`Payments · ${data.runNumber}`}
        description="Payment snapshots are frozen after prepare — changing employee bank accounts later does not rewrite these rows."
        backHref={`/payroll/runs/${data.payRunId}`}
        backLabel="Pay run"
        actions={
          <PageActionsEnd>
            {canManage && isPosted && !paymentSummary.prepared ? (
              <PaymentActionForm
                action={preparePayRunPayments}
                hidden={{ payRunId: data.payRunId }}
              >
                <Button type="submit">
                  <Wallet />
                  Prepare payments
                </Button>
              </PaymentActionForm>
            ) : null}
            {canManage && isPosted && paymentSummary.prepared ? (
              <>
                {flags.manualPaymentEnabled ? (
                  <PaymentActionForm
                    action={createPayRunPaymentBatch}
                    hidden={{ payRunId: data.payRunId, mode: "manual" }}
                  >
                    <Button type="submit" variant="outline">
                      <FileText />
                      Manual register batch
                    </Button>
                  </PaymentActionForm>
                ) : null}
                {flags.achExportEnabled ? (
                  <PaymentActionForm
                    action={createPayRunPaymentBatch}
                    hidden={{ payRunId: data.payRunId, mode: "ach" }}
                  >
                    <Button type="submit">
                      <Landmark />
                      Generate ACH batch
                    </Button>
                  </PaymentActionForm>
                ) : null}
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link href={`/payroll/runs/${data.payRunId}/bank-export`} />
                  }
                >
                  <Download />
                  Bank CSV
                </Button>
              </>
            ) : null}
          </PageActionsEnd>
        }
      />

      {!flags.bankingEnabled ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Payroll banking is disabled — prepare will create NOT_CONFIGURED
          stubs only.
        </p>
      ) : null}

      {!flags.achExportEnabled ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <p className="font-medium">ACH export is disabled</p>
          <p className="mt-1 text-muted-foreground">
            Enable <code className="text-xs">ACH_EXPORT_ENABLED</code> in
            Administration → Feature controls when your bank layout is
            confirmed. Until then, use{" "}
            <strong>Manual register batch</strong> or <strong>Bank CSV</strong>{" "}
            — both remain available when manual payment export is on.
          </p>
        </div>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Prepared</p>
          <p className="mt-1 text-lg font-medium">
            {paymentSummary.prepared ? "Yes" : "No"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="mt-1 text-lg font-medium">
            {paymentSummary.paymentCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ready</p>
          <p className="mt-1 text-lg font-medium">{paymentSummary.readyCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Allocated</p>
          <p className="mt-1 text-lg font-medium">
            {paymentSummary.totalAllocatedLabel}
          </p>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading>Payment batches</SectionHeading>
        {data.batches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No payment batches yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Batch</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Profile</th>
                  <th className="py-2 pr-4 font-medium">Lines</th>
                  <th className="py-2 pr-4 font-medium">Control total</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium">
                      {batch.batchNumber}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={statusBadgeVariant(batch.status)}>
                        {batch.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      {batch.profileName}
                      {batch.isPlaceholder ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (placeholder)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">{batch.detailCount}</td>
                    <td className="py-2.5 pr-4">{batch.controlTotalLabel}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          nativeButton={false}
                          size="sm"
                          variant="outline"
                          render={<Link href={batch.viewHref} />}
                        >
                          View
                        </Button>
                        {batch.downloadHref ? (
                          <Button
                            nativeButton={false}
                            size="sm"
                            variant="outline"
                            render={<Link href={batch.downloadHref} />}
                          >
                            <Download />
                            Download
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeading>Employee payments</SectionHeading>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {isPosted
              ? "Payments have not been prepared for this run."
              : "Post the pay run before preparing payments."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Employee</th>
                  <th className="py-2 pr-4 font-medium">Method</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Net</th>
                  <th className="py-2 pr-4 font-medium">Allocated</th>
                  <th className="py-2 font-medium">Lines</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{payment.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {payment.employeeNumber}
                      </div>
                      {payment.setupErrorMessage ? (
                        <div className="mt-1 text-xs text-destructive">
                          {payment.setupErrorMessage}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">{payment.paymentMethod}</td>
                    <td className="py-2.5 pr-4">
                      <Badge
                        variant={statusBadgeVariant(payment.paymentStatus)}
                      >
                        {payment.paymentStatus}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4">{payment.netPayLabel}</td>
                    <td className="py-2.5 pr-4">{payment.allocatedLabel}</td>
                    <td className="py-2.5">{payment.allocationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}

export function AchPaymentBatchDetailView({
  batch,
  canManage,
  canManageReturns = false,
}: {
  batch: AchPaymentBatchDetailData;
  canManage: boolean;
  canManageReturns?: boolean;
}) {
  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title={batch.batchNumber}
        description={`${batch.profile.name}${batch.profile.isPlaceholder ? " · Placeholder / requires bank confirmation" : ""} · ${batch.detailCount} lines · ${batch.controlTotalLabel}`}
        backHref={`/payroll/runs/${batch.payRun.id}/payments`}
        backLabel="Payments"
        actions={
          <PageActionsEnd>
            {canManage && batch.canApprove ? (
              <PaymentActionForm
                action={approvePayRunPaymentBatch}
                hidden={{
                  batchId: batch.id,
                  payRunId: batch.payRun.id,
                }}
              >
                <Button type="submit">
                  <CheckCircle2 />
                  Approve batch
                </Button>
              </PaymentActionForm>
            ) : null}
            {canManage && batch.canGenerate ? (
              <PaymentActionForm
                action={generatePayRunPaymentBatchFile}
                hidden={{
                  batchId: batch.id,
                  payRunId: batch.payRun.id,
                }}
              >
                <Button type="submit" variant="outline">
                  <FileText />
                  Generate file
                </Button>
              </PaymentActionForm>
            ) : null}
            {batch.downloadHref ? (
              <Button
                nativeButton={false}
                render={<Link href={batch.downloadHref} />}
              >
                <Download />
                Download
              </Button>
            ) : null}
          </PageActionsEnd>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1">
            <Badge variant={statusBadgeVariant(batch.status)}>
              {batch.status}
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Adapter</p>
          <p className="mt-1 text-sm font-medium">
            {batch.profile.adapterKind}
            {batch.profile.isPlaceholder
              ? " · Placeholder / requires bank confirmation"
              : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">File</p>
          <p className="mt-1 text-sm font-medium">
            {batch.fileName ?? "Not generated"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Content hash</p>
          <p className="mt-1 truncate font-mono text-xs">
            {batch.fileContentHash ?? "—"}
          </p>
        </div>
      </section>

      <section>
        <SectionHeading>Batch details</SectionHeading>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Employee</th>
                <th className="py-2 pr-4 font-medium">Bank</th>
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Kind</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batch.details.map((detail) => {
                const canReturn =
                  canManageReturns &&
                  (detail.allocationStatus === "EXPORTED" ||
                    detail.allocationStatus === "INCLUDED_IN_BATCH" ||
                    detail.allocationStatus === "READY" ||
                    detail.allocationStatus === "PAID");
                const canResolve =
                  canManageReturns &&
                  (detail.allocationStatus === "RETURNED" ||
                    detail.allocationStatus === "REJECTED" ||
                    detail.allocationStatus === "FAILED");

                return (
                  <tr key={detail.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{detail.sequence}</td>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{detail.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {detail.employeeNumber}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">{detail.bankName}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">
                      {detail.accountNumberMasked}
                    </td>
                    <td className="py-2.5 pr-4">{detail.allocationKind}</td>
                    <td className="py-2.5 pr-4">{detail.amountLabel}</td>
                    <td className="py-2.5 pr-4">
                      <Badge
                        variant={statusBadgeVariant(detail.allocationStatus)}
                      >
                        {detail.allocationStatus}
                      </Badge>
                      {detail.returnCode || detail.returnReason ? (
                        <p className="mt-1 max-w-[12rem] text-xs text-muted-foreground">
                          {[detail.returnCode, detail.returnReason]
                            .filter(Boolean)
                            .join(" — ")}
                          {detail.returnedAmountLabel
                            ? ` · ${detail.returnedAmountLabel}`
                            : ""}
                        </p>
                      ) : null}
                      {detail.resolutionNote ? (
                        <p className="mt-1 max-w-[12rem] text-xs text-muted-foreground">
                          {detail.resolutionNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-2">
                        {canReturn ? (
                          <>
                            <PaymentActionForm
                              action={markPayRunAllocationReturned}
                              hidden={{
                                allocationId: detail.allocationId,
                                payRunId: batch.payRun.id,
                                batchId: batch.id,
                                outcome: "RETURNED",
                              }}
                            >
                              <Button type="submit" size="sm" variant="outline">
                                Mark returned
                              </Button>
                            </PaymentActionForm>
                            <PaymentActionForm
                              action={markPayRunAllocationReturned}
                              hidden={{
                                allocationId: detail.allocationId,
                                payRunId: batch.payRun.id,
                                batchId: batch.id,
                                outcome: "REJECTED",
                              }}
                            >
                              <Button type="submit" size="sm" variant="outline">
                                Mark rejected
                              </Button>
                            </PaymentActionForm>
                          </>
                        ) : null}
                        {canResolve ? (
                          <>
                            <PaymentActionForm
                              action={resolvePayRunAllocation}
                              hidden={{
                                allocationId: detail.allocationId,
                                payRunId: batch.payRun.id,
                                batchId: batch.id,
                                resolutionNote:
                                  "Resolved as manual payment / acknowledged.",
                              }}
                            >
                              <Button type="submit" size="sm" variant="outline">
                                Resolve
                              </Button>
                            </PaymentActionForm>
                            <PaymentActionForm
                              action={regeneratePayRunAllocation}
                              hidden={{
                                allocationId: detail.allocationId,
                                payRunId: batch.payRun.id,
                                batchId: batch.id,
                                note: "Regenerated replacement allocation.",
                              }}
                            >
                              <Button type="submit" size="sm">
                                Regenerate
                              </Button>
                            </PaymentActionForm>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
