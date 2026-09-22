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
  decideEarningTreatmentOverride,
  requestEarningTreatmentOverride,
  type EarningTreatmentOverrideFormState,
} from "@/src/modules/payroll/actions/manage-earning-treatment-overrides";
import type { EarningTreatmentOverrideRow } from "@/src/modules/payroll/data/get-earning-treatment-overrides";

const idle: EarningTreatmentOverrideFormState = {
  status: "idle",
  message: "",
};

const TREATMENTS = [
  { value: "TAXABLE_EMPLOYMENT", label: "Taxable employment" },
  { value: "NON_TAXABLE", label: "Non-taxable" },
  { value: "NIS_ONLY", label: "NIS only" },
  { value: "PAYE_EXEMPT", label: "PAYE exempt" },
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
      return "destructive";
    default:
      return "secondary";
  }
}

export function EmployeeEarningTreatmentOverridesPanel({
  employeeId,
  taxYear,
  overrides,
  componentOptions,
  canManage,
}: {
  employeeId: string;
  taxYear: number;
  overrides: EarningTreatmentOverrideRow[];
  componentOptions: Array<{ id: string; code: string; name: string }>;
  canManage: boolean;
}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestEarningTreatmentOverride,
    idle,
  );
  const [decideState, decideAction, decidePending] = useActionState(
    decideEarningTreatmentOverride,
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
        <SectionHeading>Earning treatment overrides</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Per-employee tax treatment for recurring components. Approved
          overrides apply on payslip assembly and projected earnings.
        </p>
      </div>

      {canManage && componentOptions.length > 0 ? (
        <form
          action={requestAction}
          className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-2"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="space-y-1.5 md:col-span-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="componentDefinitionId"
            >
              Component
            </label>
            <select
              id="componentDefinitionId"
              name="componentDefinitionId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select component…
              </option>
              {componentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.code} — {opt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="taxTreatment">
              Tax treatment
            </label>
            <select
              id="taxTreatment"
              name="taxTreatment"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue="TAXABLE_EMPLOYMENT"
            >
              {TREATMENTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              key={`earning-effective-${taxYear}`}
              defaultValue={`${taxYear}-01-01`}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="includeInProjectedEarnings"
                defaultChecked
              />
              Include in projected remaining earnings
            </label>
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
              {requestPending ? "Submitting…" : "Submit override"}
            </Button>
          </div>
        </form>
      ) : null}

      {overrides.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No earning treatment overrides.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Component</th>
                <th className="px-3 py-2 font-medium">Treatment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Decide</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">
                      {row.componentCode} — {row.componentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Default {row.defaultTaxTreatment.replaceAll("_", " ")} ·{" "}
                      {row.effectiveFrom}
                      {row.includeInProjectedEarnings
                        ? " · in projection"
                        : " · excluded from projection"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.taxTreatment.replaceAll("_", " ")}
                    <p className="text-xs text-muted-foreground">{row.reason}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {canManage && row.status === "PENDING_APPROVAL" ? (
                      <div className="flex gap-1">
                        <form action={decideAction}>
                          <input type="hidden" name="overrideId" value={row.id} />
                          <input type="hidden" name="decision" value="APPROVE" />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={decidePending}
                          >
                            <Check className="size-4" />
                          </Button>
                        </form>
                        <form action={decideAction}>
                          <input type="hidden" name="overrideId" value={row.id} />
                          <input type="hidden" name="decision" value="REJECT" />
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
