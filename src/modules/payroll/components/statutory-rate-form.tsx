"use client";

import { useActionState, useEffect } from "react";
import { Landmark, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  createStatutoryRate,
  updateStatutoryRate,
  type StatutoryRateFormState,
} from "@/src/modules/payroll/actions/manage-statutory-rate";
import type { StatutoryRateRecord } from "@/src/modules/payroll/lib/statutory-rate-types";
import { PayrollNav } from "./payroll-nav";

const initialState: StatutoryRateFormState = {
  status: "idle",
  message: "",
};

export function StatutoryRateForm({
  rate,
}: {
  rate?: StatutoryRateRecord | null;
}) {
  const action = rate ? updateStatutoryRate : createStatutoryRate;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>
        <PayrollNav />

        {rate && <input type="hidden" name="id" value={rate.id} />}

        <PageHeader
          title={rate ? "Edit Statutory Rate" : "New Statutory Rate"}
          description="Legacy flat PAYE percentage. Prefer the annual PAYE configuration at Payroll Settings → PAYE."
          backHref="/payroll/settings/paye"
          backLabel="PAYE settings"
          actions={
            <FormPageActions cancelHref="/payroll/settings">
              <Button type="submit" disabled={pending}>
                <Save />
                {pending ? "Saving…" : "Save rate"}
              </Button>
            </FormPageActions>
          }
        />

        {state.status === "error" && (
          <div
            role="alert"
            className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <SectionHeading>Rate details</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rateType">
                Rate type
              </label>
              <select
                id="rateType"
                name="rateType"
                defaultValue={rate?.rateType ?? "PAYE"}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PAYE">PAYE (legacy flat %)</option>
              </select>
              {state.fieldErrors?.rateType && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.rateType}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="ratePercent">
                Rate (%)
              </label>
              <Input
                id="ratePercent"
                name="ratePercent"
                type="number"
                min={0}
                max={100}
                step={0.0001}
                defaultValue={rate?.ratePercent ?? ""}
                required
              />
              {state.fieldErrors?.ratePercent && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.ratePercent}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="effectiveFrom">
                Effective from
              </label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                defaultValue={rate?.effectiveFrom ?? ""}
                required
              />
              {state.fieldErrors?.effectiveFrom && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.effectiveFrom}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="effectiveTo">
                Effective to (optional)
              </label>
              <Input
                id="effectiveTo"
                name="effectiveTo"
                type="date"
                defaultValue={rate?.effectiveTo ?? ""}
              />
              {state.fieldErrors?.effectiveTo && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.effectiveTo}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="notes">
                Notes
              </label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={rate?.notes ?? ""}
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={rate?.isActive ?? true}
              />
              Active
            </label>
          </div>
        </section>
      </PageShell>
    </form>
  );
}
