"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import {
  PAY_RUN_PAYEE_GROUP_OPTIONS,
  type PayRunPayeeGroupValue,
} from "@/src/modules/payroll/lib/pay-run-payee-group";
import { PayrollNav } from "./payroll-nav";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

export function CreatePayPeriodForm({
  defaultPeriodKey,
  readyCounts,
}: {
  defaultPeriodKey: string;
  readyCounts: Record<PayRunPayeeGroupValue, number>;
}) {
  const [state, formAction, pending] = useActionState(
    createMonthlyPayPeriod,
    initialState,
  );
  const [payeeGroup, setPayeeGroup] =
    useState<PayRunPayeeGroupValue>("EMPLOYEE");

  const readyCount = readyCounts[payeeGroup] ?? 0;
  const selectedOption = useMemo(
    () =>
      PAY_RUN_PAYEE_GROUP_OPTIONS.find((option) => option.value === payeeGroup),
    [payeeGroup],
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
          description="Creates a monthly payroll period (or reuses one) and a draft pay run for one payee group only — employees and board members stay in separate runs."
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
                  One regular run per group per month. Older runs without a
                  group count as Employees.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Ready in selected group</p>
              <p className="text-2xl font-semibold">{readyCount}</p>
              <p className="text-xs text-muted-foreground">
                Only payroll-ready people in{" "}
                {selectedOption?.label.toLowerCase() ?? "this group"} are
                included.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="text-sm font-medium" htmlFor="payeeGroup">
              Payee group
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {PAY_RUN_PAYEE_GROUP_OPTIONS.map((option) => {
                const count = readyCounts[option.value] ?? 0;
                const selected = payeeGroup === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-lg border px-3 py-3 transition-colors ${
                      selected
                        ? "border-border bg-muted/50"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payeeGroup"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPayeeGroup(option.value)}
                      className="sr-only"
                    />
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                      {count} ready
                    </p>
                  </label>
                );
              })}
            </div>
            {state.fieldErrors?.payeeGroup ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.payeeGroup}
              </p>
            ) : null}
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
