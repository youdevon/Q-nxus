"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  saveOpeningYtd,
  type OpeningYtdFormState,
} from "@/src/modules/payroll/actions/manage-opening-ytd";
import type { EmployeePayrollSetup } from "@/src/modules/payroll/lib/payroll-setup-types";

const initialState: OpeningYtdFormState = {
  status: "idle",
  message: "",
};

type EmployeeOpeningYtdFormProps = {
  setup: EmployeePayrollSetup;
};

export function EmployeeOpeningYtdForm({ setup }: EmployeeOpeningYtdFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveOpeningYtd,
    initialState,
  );
  const opening = setup.openingYtd;

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      router.refresh();
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <PageShell size="lg" className="min-w-0 pt-0 sm:pt-0 md:pt-0 lg:pt-0">
      <form action={formAction} className="min-w-0 space-y-6">
        <input type="hidden" name="employeeId" value={setup.employee.id} />
        <input type="hidden" name="taxYear" value={opening.taxYear} />

        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <SectionHeading>
              Opening YTD · {opening.taxYear}
            </SectionHeading>
            <p className="text-sm text-muted-foreground">
              Same employer — system go-live / migration balances already paid
              under this employer before Q-NXUS. Not prior-employer income.
            </p>
          </div>
          <Button type="submit" disabled={pending} size="sm">
            <Save className="size-4" />
            {pending ? "Saving…" : "Save opening YTD"}
          </Button>
        </div>

        {state.status === "error" && state.message ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}

        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-pretty text-xs text-muted-foreground">
          Use <strong className="font-medium text-foreground">Prior employment</strong>{" "}
          below for income from a different employer this tax year. Opening YTD
          only covers this employer&apos;s pre-go-live posted periods.
        </div>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="openingAsOfDate">
              As-of date
            </label>
            <Input
              id="openingAsOfDate"
              name="asOfDate"
              type="date"
              defaultValue={opening.asOfDate ?? ""}
              required
            />
            {state.fieldErrors?.asOfDate ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.asOfDate}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="openingTaxableIncomeYtd"
            >
              Taxable income YTD (TTD)
            </label>
            <Input
              id="openingTaxableIncomeYtd"
              name="taxableIncomeYtd"
              type="number"
              min={0}
              step={0.01}
              defaultValue={opening.taxableIncomeYtd}
              required
            />
            {state.fieldErrors?.taxableIncomeYtd ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.taxableIncomeYtd}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="openingPayeDeductedYtd">
              PAYE deducted YTD (TTD)
            </label>
            <Input
              id="openingPayeDeductedYtd"
              name="payeDeductedYtd"
              type="number"
              min={0}
              step={0.01}
              defaultValue={opening.payeDeductedYtd}
              required
            />
            {state.fieldErrors?.payeDeductedYtd ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.payeDeductedYtd}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="openingNisEmployeeYtd">
              NIS employee YTD (TTD)
            </label>
            <Input
              id="openingNisEmployeeYtd"
              name="nisEmployeeYtd"
              type="number"
              min={0}
              step={0.01}
              defaultValue={opening.nisEmployeeYtd ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="openingHealthSurchargeYtd"
            >
              Health surcharge YTD (TTD)
            </label>
            <Input
              id="openingHealthSurchargeYtd"
              name="healthSurchargeYtd"
              type="number"
              min={0}
              step={0.01}
              defaultValue={opening.healthSurchargeYtd ?? ""}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="openingNotes">
              Notes
            </label>
            <Textarea
              id="openingNotes"
              name="notes"
              rows={2}
              defaultValue={opening.notes ?? ""}
              placeholder="Source of go-live balances (legacy payroll export, etc.)"
            />
          </div>
        </div>

        <label className="flex min-w-0 items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="verified"
            className="mt-0.5 shrink-0"
            defaultChecked={opening.verified}
          />
          <span className="min-w-0 text-pretty">
            Verified — include in current-employer YTD for PAYE (unverified stays
            out of calc)
          </span>
        </label>
      </form>
    </PageShell>
  );
}
