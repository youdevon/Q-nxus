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
  decideTaxYearAdjustment,
  requestTaxYearAdjustment,
  type TaxYearAdjustmentFormState,
} from "@/src/modules/payroll/actions/manage-tax-year-adjustments";
import { formatMoney } from "@/src/lib/format";
import type { TaxYearAdjustmentListRow } from "@/src/modules/payroll/data/get-employee-tax-year-page";

const idle: TaxYearAdjustmentFormState = { status: "idle", message: "" };

const ADJUSTMENT_TYPES = [
  { value: "PREVIOUS_INCOME", label: "Previous income (+)" },
  { value: "PREVIOUS_PAYE", label: "Previous PAYE (+)" },
  { value: "PERSONAL_ALLOWANCE", label: "Personal allowance (+)" },
  { value: "TAXABLE_EARNINGS", label: "Taxable earnings YTD (+)" },
  { value: "NON_TAXABLE_EARNINGS", label: "Non-taxable earnings (+)" },
  { value: "PROJECTED_EARNINGS", label: "Projected earnings / period (+)" },
  { value: "PAYE", label: "Manual tax adjustment (+ remaining)" },
  { value: "NIS", label: "NIS YTD (+)" },
  { value: "HEALTH_SURCHARGE", label: "Health surcharge YTD (+)" },
  { value: "PENSION", label: "Pension (+)" },
  { value: "QUALIFYING_DEDUCTION", label: "Other qualifying deduction (+)" },
  {
    value: "REMAINING_PERIOD",
    label: "Remaining periods (absolute override)",
  },
  {
    value: "NIS_DEDUCTIBLE_PORTION",
    label: "NIS deductible portion 0–1 (absolute)",
  },
  {
    value: "APPROVED_DEDUCTION_CAP",
    label: "Approved deduction cap (absolute)",
  },
  { value: "OTHER_TAX", label: "Other tax adj. (+ remaining)" },
  { value: "TAX_RATE_INSTRUCTION", label: "IRD rate instruction (+ remaining)" },
] as const;

function statusVariant(
  status: string,
): "secondary" | "warning" | "success" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING_APPROVAL":
      return "warning";
    case "REJECTED":
    case "REVERSED":
      return "destructive";
    default:
      return "secondary";
  }
}

export function EmployeeTaxYearAdjustmentsPanel({
  employeeId,
  taxYear,
  adjustments,
  canRequest,
  canDecide,
  currency,
}: {
  employeeId: string;
  taxYear: number;
  adjustments: TaxYearAdjustmentListRow[];
  canRequest: boolean;
  canDecide: boolean;
  currency: string;
}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestTaxYearAdjustment,
    idle,
  );
  const [decideState, decideAction, decidePending] = useActionState(
    decideTaxYearAdjustment,
    idle,
  );

  useEffect(() => {
    for (const state of [requestState, decideState]) {
      if (state.status === "success" && state.message) {
        toast.success(state.message);
      } else if (state.status === "error" && state.message) {
        toast.error(state.message);
      }
    }
  }, [requestState, decideState]);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <SectionHeading>Tax-year adjustments</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Maker-checker overrides for this employee&apos;s projection. Additive
          types adjust buckets; absolute types replace formula inputs
          (remaining periods, NIS portion, deduction cap). Org-wide rate
          changes belong under Payroll → Settings → PAYE (versioned by
          effective date). Approved changes refresh the live projection,
          open projection versions, and draft pay runs — posted payslips stay
          frozen.
        </p>
      </div>

      {canRequest ? (
        <form
          action={requestAction}
          className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-2"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="taxYear" value={taxYear} />
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="adjustmentType">
              Type
            </label>
            <select
              id="adjustmentType"
              name="adjustmentType"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue="PAYE"
            >
              {ADJUSTMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="adjustmentValue"
            >
              Amount
            </label>
            <Input
              id="adjustmentValue"
              name="adjustmentValue"
              inputMode="decimal"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="effectiveFrom"
            >
              Effective from
            </label>
            <Input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              key={`adjustment-effective-${taxYear}`}
              defaultValue={`${taxYear}-01-01`}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs text-muted-foreground" htmlFor="reason">
              Reason
            </label>
            <Textarea id="reason" name="reason" rows={2} required />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" size="sm" disabled={requestPending}>
              <Save className="size-4" />
              {requestPending ? "Submitting…" : "Submit for approval"}
            </Button>
          </div>
        </form>
      ) : null}

      {adjustments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No adjustments for {taxYear}.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Decide</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2.5">
                    {row.adjustmentType.replaceAll("_", " ")}
                    <p className="text-xs text-muted-foreground">
                      from {row.effectiveFrom}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(row.adjustmentValue, { currency })}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.reason}
                    {row.rejectedReason ? (
                      <p className="mt-1 text-destructive">{row.rejectedReason}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {canDecide && row.status === "PENDING_APPROVAL" ? (
                      <div className="flex flex-wrap gap-1">
                        <form action={decideAction}>
                          <input type="hidden" name="adjustmentId" value={row.id} />
                          <input type="hidden" name="decision" value="APPROVE" />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={decidePending}
                          >
                            <Check className="size-4" />
                          </Button>
                        </form>
                        <form action={decideAction} className="flex gap-1">
                          <input type="hidden" name="adjustmentId" value={row.id} />
                          <input type="hidden" name="decision" value="REJECT" />
                          <Input
                            name="rejectedReason"
                            placeholder="Reject reason"
                            className="h-8 w-28"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={decidePending}
                          >
                            <X className="size-4" />
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
