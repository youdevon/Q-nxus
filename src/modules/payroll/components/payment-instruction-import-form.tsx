"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  commitPaymentInstructionImportAction,
  previewPaymentInstructionImportAction,
  type PaymentInstructionImportActionState,
} from "@/src/modules/payroll/actions/manage-payment-instructions";

const initial: PaymentInstructionImportActionState = {
  status: "idle",
  message: "",
};

export function PaymentInstructionImportForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewPaymentInstructionImportAction,
    initial,
  );
  const [commitState, commitAction, commitPending] = useActionState(
    commitPaymentInstructionImportAction,
    initial,
  );

  const preview = useMemo(() => {
    if (!previewState.previewJson) {
      return null;
    }
    try {
      return JSON.parse(previewState.previewJson) as {
        ok: boolean;
        summary: {
          totalRows: number;
          validRows: number;
          errorRows: number;
          warningRows: number;
          duplicateRows: number;
        };
        issues: Array<{
          rowNumber: number;
          severity: string;
          message: string;
        }>;
      };
    } catch {
      return null;
    }
  }, [previewState.previewJson]);

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          Import employee payment instructions linked to HR employees. Required
          columns match ACH needs: holder name, institution, account number,
          Savings/Chequing. Branch/Transit is optional. Active instructions are
          never overwritten silently — use{" "}
          <strong>UPDATE_EXPLICIT</strong> to supersede (history retained).
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="w-fit"
          render={<Link href="/payroll/payment-instructions/import/template" />}
        >
          Download CSV template
        </Button>
      </div>

      <form action={previewAction} className="grid gap-4 rounded-lg border p-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="mode">
            Import mode
          </label>
          <select
            id="mode"
            name="mode"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue="CREATE_ONLY"
          >
            <option value="CREATE_ONLY">Create only (block if active exists)</option>
            <option value="UPDATE_EXPLICIT">
              Update explicit (deactivate prior + create new)
            </option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="file">
            CSV file
          </label>
          <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <Button type="submit" disabled={previewPending}>
          {previewPending ? "Validating…" : "Validate & preview"}
        </Button>
        {previewState.message ? (
          <p
            className={
              previewState.status === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {previewState.message}
          </p>
        ) : null}
      </form>

      {preview ? (
        <div className="grid gap-4 rounded-lg border p-4">
          <p className="text-sm">
            Rows: {preview.summary.totalRows} · Valid: {preview.summary.validRows} ·
            Errors: {preview.summary.errorRows} · Warnings:{" "}
            {preview.summary.warningRows} · Duplicates:{" "}
            {preview.summary.duplicateRows}
          </p>
          {preview.issues.length > 0 ? (
            <ul className="max-h-48 list-disc space-y-1 overflow-auto pl-5 text-xs">
              {preview.issues.slice(0, 50).map((issue, index) => (
                <li
                  key={`${issue.rowNumber}-${index}`}
                  className={
                    issue.severity === "error" ? "text-destructive" : undefined
                  }
                >
                  Row {issue.rowNumber}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          <form action={commitAction} className="flex flex-wrap gap-2">
            <input
              type="hidden"
              name="previewJson"
              value={previewState.previewJson ?? ""}
            />
            <Button
              type="submit"
              name="dryRun"
              value="1"
              variant="outline"
              disabled={commitPending}
            >
              Dry-run validation
            </Button>
            <Button
              type="submit"
              name="confirm"
              value="1"
              disabled={commitPending || !preview.ok}
            >
              Confirm & save
            </Button>
          </form>
          {commitState.message ? (
            <p
              className={
                commitState.status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {commitState.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
