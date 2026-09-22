"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Download, Landmark, Settings } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  generateFcbLegacyAchFromPayRun,
  updateAchBankValidationStatus,
  type AchGenerateFormState,
} from "@/src/modules/payroll/actions/generate-fcb-legacy-ach";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import {
  formatAchPreviewTotal,
  type AchPreviewPageData,
} from "@/src/modules/payroll/data/ach-preview-types";

const idle: AchGenerateFormState = { status: "idle", message: "" };

export function AchPreviewView({
  data,
  canGenerate,
  canDownload,
  canConfigure,
}: {
  data: AchPreviewPageData;
  canGenerate: boolean;
  canDownload: boolean;
  canConfigure: boolean;
}) {
  const [genState, genAction, genPending] = useActionState(
    generateFcbLegacyAchFromPayRun,
    idle,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateAchBankValidationStatus,
    idle,
  );

  useEffect(() => {
    if (genState.status === "success") {
      toast.success(genState.message);
      if (genState.downloadHref) {
        window.location.href = genState.downloadHref;
      }
    } else if (genState.status === "error") {
      toast.error(genState.message);
    }
  }, [genState]);

  useEffect(() => {
    if (statusState.status === "success") {
      toast.success(statusState.message);
    } else if (statusState.status === "error") {
      toast.error(statusState.message);
    }
  }, [statusState]);

  const v = data.validation;

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title={`ACH export · ${data.runNumber}`}
        description={`${v.exportFormatLabel}. Preview and validate before downloading the salary .txt for First Citizens Business Online.`}
        backHref={`/payroll/runs/${data.payRunId}`}
        backLabel="Pay run"
        actions={
          <PageActionsEnd>
            {canConfigure ? (
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href="/payroll/settings/ach" />}
              >
                <Settings />
                ACH settings
              </Button>
            ) : null}
            {canDownload && data.latestBatch?.downloadHref ? (
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={data.latestBatch.downloadHref} />}
              >
                <Download />
                Download last file
              </Button>
            ) : null}
            {canGenerate && data.settingsEnabled ? (
              <form action={genAction}>
                <input type="hidden" name="payRunId" value={data.payRunId} />
                <Button type="submit" disabled={genPending || v.blockingErrors.length > 0}>
                  <Landmark />
                  {genPending
                    ? "Generating…"
                    : data.latestBatch?.status === "INVALIDATED" ||
                        data.latestBatch?.fileName
                      ? "Regenerate ACH file"
                      : "Generate ACH file"}
                </Button>
              </form>
            ) : null}
          </PageActionsEnd>
        }
      />

      {!data.settingsEnabled ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          ACH export is off. Turn it on in{" "}
          <Link href="/payroll/settings/ach" className="underline">
            ACH settings
          </Link>
          .
        </div>
      ) : null}

      {data.forceLegacyTransactionCode ? (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          Legacy transaction-code override is active — all rows will use the
          configured legacy code.
        </p>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="mt-1 text-sm font-medium">{data.periodName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payment date</p>
          <p className="mt-1 text-sm font-medium">{data.paymentDate}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Format</p>
          <p className="mt-1 font-mono text-xs">{v.exportFormat}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total ACH credits</p>
          <p className="mt-1 text-sm font-medium">
            {formatAchPreviewTotal(v.totalAmount, data.currencyCode)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="mt-1 text-sm font-medium">{v.employeeCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Valid / errors</p>
          <p className="mt-1 text-sm font-medium">
            {v.validCount} / {v.errorCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Warnings</p>
          <p className="mt-1 text-sm font-medium">{v.warningCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last batch</p>
          <p className="mt-1 text-sm font-medium">
            {data.latestBatch
              ? `${data.latestBatch.batchNumber} · ${data.latestBatch.status}`
              : "—"}
          </p>
          {data.latestBatch?.status === "INVALIDATED" ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Payroll amounts changed after this file was generated. Regenerate
              required.
            </p>
          ) : null}
        </div>
      </section>

      {v.blockingErrors.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <p className="font-medium">Export blocked</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {v.blockingErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {v.blockingErrors.some((error) => /ACH banks/i.test(error)) ? (
            <p className="mt-3">
              <Link
                href="/payroll/settings/ach/banks"
                className="underline underline-offset-2"
              >
                Open ACH banks & routing
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {v.advisoryNotes.length > 0 ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-border/70 bg-muted/30 px-4 py-3 text-sm"
        >
          <p className="font-medium">Advisory</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {v.advisoryNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.latestBatch ? (
        <section className="mb-8">
          <SectionHeading>Bank validation status</SectionHeading>
          <form action={statusAction} className="mt-3 grid max-w-xl gap-3">
            <input type="hidden" name="batchId" value={data.latestBatch.id} />
            <input type="hidden" name="payRunId" value={data.payRunId} />
            <select
              name="bankValidationStatus"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              defaultValue={
                data.latestBatch.bankValidationStatus ?? "GENERATED"
              }
            >
              <option value="GENERATED">Generated</option>
              <option value="UPLOADED_FOR_VALIDATION">
                Uploaded for validation
              </option>
              <option value="VALIDATION_FAILED">Validation failed</option>
              <option value="BANK_VALIDATED">Bank validated</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PROCESSED">Processed</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <input
              name="fcbErrorCode"
              placeholder="FCB error code (optional)"
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <textarea
              name="fcbErrorMessage"
              rows={2}
              placeholder="FCB error message / notes"
              defaultValue={data.latestBatch.fcbErrorMessage ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" variant="outline" disabled={statusPending}>
              {statusPending ? "Saving…" : "Update bank status"}
            </Button>
          </form>
        </section>
      ) : null}

      <section>
        <SectionHeading>ACH payment preview</SectionHeading>
        <p className="mt-1 text-xs text-muted-foreground">
          Payment date is only in Individual Identification (
          <code className="text-[11px]">SALARY YYYYMMDD</code>, positions
          40–54). Trace Number (positions 80–94) is an opaque 15-digit string —
          digits that look like a period inside it are coincidental.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[80rem] text-left text-sm">
            <thead className="border-b border-border/70 text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Emp #</th>
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">ACH amount field</th>
                <th className="py-2 pr-3 font-medium">Individual ID</th>
                <th className="py-2 pr-3 font-medium">Trace Number</th>
                <th className="py-2 pr-3 font-medium">Len</th>
                <th className="py-2 pr-3 font-medium">Bank / ABA / Txn</th>
                <th className="py-2 font-medium">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {v.rows.map((row) => (
                <tr key={`${row.employeeNumber}-${row.sequence}`}>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.employeeNumber}
                  </td>
                  <td className="py-2 pr-3">
                    <div>{row.employeeName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {row.accountNumberMasked} · {row.accountType ?? "—"}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {formatAchPreviewTotal(row.amount, row.currencyCode)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.amountField ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.achIndividualIdentification}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.achTraceNumber ?? row.traceNumber ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.recordLength ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <div>{row.bankName}</div>
                    <div className="font-mono text-muted-foreground">
                      {row.routingNumber ?? "—"} · {row.transactionCode ?? "—"}
                    </div>
                  </td>
                  <td className="py-2">
                    {row.ok ? (
                      <Badge variant="success">PASS</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="destructive">FAIL</Badge>
                        {row.issues
                          .filter((issue) => issue.severity === "error")
                          .map((issue) => (
                            <p
                              key={`${issue.code}-${issue.message}`}
                              className="text-xs text-muted-foreground"
                            >
                              {issue.field}: {issue.message}
                            </p>
                          ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No prepared bank payment allocations. Prepare payments on the pay
              run first.
            </p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
