"use client";

import { useActionState, useEffect } from "react";
import { Check, RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  applyAnnualPayeProjectionToPayroll,
  approveAnnualPayeProjection,
  saveAnnualPayeProjection,
  submitAnnualPayeProjectionForReview,
  type ProjectionActionState,
} from "@/src/modules/payroll/actions/manage-annual-paye-projection";
import { formatMoney } from "@/src/lib/format";
import type { SavedAnnualProjectionRow } from "@/src/modules/payroll/data/get-annual-paye-projections";

const idle: ProjectionActionState = { status: "idle", message: "" };

function statusVariant(
  status: string,
): "secondary" | "warning" | "success" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REVIEW_REQUIRED":
      return "warning";
    case "SUPERSEDED":
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

function useToastOnState(state: ProjectionActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

export function AnnualPayeProjectionActions({
  employeeId,
  taxYear,
  currency,
  savedProjections,
  canSave,
  canApprove,
  canApply,
}: {
  employeeId: string;
  taxYear: number;
  currency: string;
  savedProjections: SavedAnnualProjectionRow[];
  canSave: boolean;
  canApprove: boolean;
  canApply: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveAnnualPayeProjection,
    idle,
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitAnnualPayeProjectionForReview,
    idle,
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveAnnualPayeProjection,
    idle,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applyAnnualPayeProjectionToPayroll,
    idle,
  );

  useToastOnState(saveState);
  useToastOnState(submitState);
  useToastOnState(approveState);
  useToastOnState(applyState);

  const latest = savedProjections[0] ?? null;
  const approved = savedProjections.find((row) => row.status === "APPROVED");

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <SectionHeading>Projection versions</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Save a versioned worksheet, submit for review, then approve. Approving
          auto-applies the recommended PAYE as approved overrides for all
          remaining open periods (posted payslips are skipped) and recalculates
          draft pay runs. Maker-checker still applies on projection approve.
        </p>
      </div>

      {canSave ? (
        <form action={saveAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="taxYear" value={taxYear} />
          <Button type="submit" size="sm" disabled={savePending}>
            <Save className="size-4" />
            {savePending ? "Saving…" : "Save projection version"}
          </Button>
        </form>
      ) : null}

      {savedProjections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved projection versions yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">
                  Remaining tax
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  PAYE / period
                </th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedProjections.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">v{row.version}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.calculationDate}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                    {row.appliedToPeriodEnd ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last applied → {row.appliedToPeriodEnd}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(row.remainingTaxLiability, { currency })}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.recommendedPayePerPeriod != null
                      ? formatMoney(row.recommendedPayePerPeriod, { currency })
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-2">
                      {canSave &&
                      (row.status === "CALCULATED" || row.status === "DRAFT") ? (
                        <form action={submitAction}>
                          <input type="hidden" name="projectionId" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={submitPending}
                          >
                            <Send className="size-4" />
                            Submit review
                          </Button>
                        </form>
                      ) : null}
                      {canApprove && row.status === "REVIEW_REQUIRED" ? (
                        <form action={approveAction}>
                          <input type="hidden" name="projectionId" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={approvePending}
                          >
                            <Check className="size-4" />
                            Approve
                          </Button>
                        </form>
                      ) : null}
                      {canApply &&
                      row.status === "APPROVED" &&
                      row.recommendedPayePerPeriod != null ? (
                        <form action={applyAction}>
                          <input type="hidden" name="projectionId" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={applyPending}
                          >
                            <RefreshCw className="size-4" />
                            {applyPending
                              ? "Re-applying…"
                              : "Re-apply to open periods"}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {latest || approved ? (
        <p className="text-xs text-muted-foreground">
          {approved
            ? `Approved v${approved.version} is shown on payslips as projected tax-year position. Use Re-apply if open drafts need the amount again after a refresh.`
            : `Latest saved: v${latest?.version} (${latest?.status}).`}
        </p>
      ) : null}
    </section>
  );
}
