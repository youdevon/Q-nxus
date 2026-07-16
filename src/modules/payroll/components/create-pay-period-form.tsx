"use client";

import { useActionState, useEffect } from "react";
import { CalendarDays, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  createMonthlyPayPeriod,
  type PayRunFormState,
} from "@/src/modules/payroll/actions/manage-pay-run";
import { PayrollNav } from "./payroll-nav";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

export function CreatePayPeriodForm({
  defaultPeriodKey,
  readyCount,
}: {
  defaultPeriodKey: string;
  readyCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    createMonthlyPayPeriod,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>
        <PayrollNav />

        <PageHeader
          title="New pay period"
          description="Creates a monthly payroll period and draft pay run for all payroll-ready employees. Snapshots are computed from the current payslip preview rules."
          backHref="/payroll/runs"
          backLabel="Pay runs"
          actions={
            <FormPageActions cancelHref="/payroll/runs">
              <Button type="submit" disabled={pending || readyCount === 0}>
                <Save />
                {pending ? "Creating…" : "Create draft run"}
              </Button>
            </FormPageActions>
          }
        />

        {state.status === "error" ? (
          <div
            role="alert"
            className="whitespace-pre-line border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <SectionHeading>Period</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="periodKey">
                Month (YYYY-MM)
              </label>
              <Input
                id="periodKey"
                name="periodKey"
                type="month"
                defaultValue={defaultPeriodKey}
                required
                aria-invalid={Boolean(state.fieldErrors?.periodKey)}
              />
              {state.fieldErrors?.periodKey ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.periodKey}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Trinidad monthly default. Frequency remains MONTHLY for this
                  slice.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Payroll-ready employees</p>
              <p className="text-2xl font-semibold">{readyCount}</p>
              <p className="text-xs text-muted-foreground">
                Only ready employees are included. Create fails if any selected
                employee fails the readiness gate at calculation time.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
        </section>
      </PageShell>
    </form>
  );
}
