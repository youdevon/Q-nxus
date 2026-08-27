"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  saveEmployeeTaxProfile,
  type EmployeeTaxProfileFormState,
} from "@/src/modules/payroll/actions/save-employee-tax-profile";
import type { EmployeePayrollSetup } from "@/src/modules/payroll/lib/payroll-setup-types";

const initialState: EmployeeTaxProfileFormState = {
  status: "idle",
  message: "",
};

const METHOD_OPTIONS = [
  {
    value: "STANDARD_NON_CUMULATIVE",
    label: "Standard (non-cumulative)",
  },
  {
    value: "STANDARD_CUMULATIVE",
    label: "Standard (cumulative) — Phase 4",
  },
  {
    value: "PREVIOUS_INCOME_INCLUDED",
    label: "Previous income included — Phase 3",
  },
  {
    value: "MANUAL_INSTRUCTION",
    label: "Manual instruction",
  },
  {
    value: "SPECIAL_IRD_INSTRUCTION",
    label: "Special IRD instruction",
  },
] as const;

const ALLOWANCE_SOURCE_OPTIONS = [
  { value: "STATUTORY_DEFAULT", label: "Statutory default" },
  { value: "TD1", label: "TD1" },
  { value: "IRD_INSTRUCTION", label: "IRD instruction" },
  { value: "MANUAL_AUTHORIZED", label: "Manual (authorized)" },
] as const;

const PREVIOUS_EMPLOYMENT_OPTIONS = [
  {
    value: "NO_PREVIOUS_EMPLOYMENT",
    label: "No previous employment this tax year",
  },
  {
    value: "PREVIOUS_EMPLOYMENT",
    label: "Yes — previous employment (enter prior YTD on setup)",
  },
  {
    value: "UNKNOWN_PREVIOUS_INCOME",
    label: "Unknown — requires review (do not assume zero)",
  },
] as const;

const OTHER_EMOLUMENT_OPTIONS = [
  { value: "NO_OTHER_EMOLUMENTS", label: "No" },
  { value: "HAS_OTHER_EMOLUMENTS", label: "Yes" },
  { value: "UNKNOWN_OTHER_EMOLUMENTS", label: "Unknown" },
] as const;

type EmployeeTaxProfileFormProps = {
  setup: EmployeePayrollSetup;
};

export function EmployeeTaxProfileForm({ setup }: EmployeeTaxProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    saveEmployeeTaxProfile,
    initialState,
  );
  const tax = setup.taxProfile;

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <PageShell size="lg" className="min-w-0 pt-0 sm:pt-0 md:pt-0 lg:pt-0">
      <form action={formAction} className="min-w-0 space-y-6">
        <input type="hidden" name="employeeId" value={setup.employee.id} />
        <input type="hidden" name="taxYear" value={tax.taxYear} />

        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <SectionHeading>
              Tax profile · {tax.taxYear}
            </SectionHeading>
            <p className="text-sm text-muted-foreground">
              Per-tax-year PAYE / TD1 treatment. TD1 amounts sync with payroll
              setup for the current year.
            </p>
          </div>
          <Button type="submit" disabled={pending} size="sm">
            <Save className="size-4" />
            {pending ? "Saving…" : "Save tax profile"}
          </Button>
        </div>

        {state.status === "error" && state.message ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium" htmlFor="taxCalculationMethod">
              Tax calculation method
            </label>
            <select
              id="taxCalculationMethod"
              name="taxCalculationMethod"
              defaultValue={tax.taxCalculationMethod}
              className="border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm"
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.taxCalculationMethod ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.taxCalculationMethod}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="personalAllowanceSource"
            >
              Personal allowance source
            </label>
            <select
              id="personalAllowanceSource"
              name="personalAllowanceSource"
              defaultValue={tax.personalAllowanceSource}
              className="border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm"
            >
              {ALLOWANCE_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium" htmlFor="personalAllowance">
              Personal allowance override (annual TTD)
            </label>
            <Input
              id="personalAllowance"
              name="personalAllowance"
              type="number"
              min={0}
              step={0.01}
              defaultValue={tax.personalAllowance ?? ""}
              placeholder="Leave blank for org statutory default"
            />
            {state.fieldErrors?.personalAllowance ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.personalAllowance}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                When set, replaces the organization PAYE personal allowance for
                this employee and tax year.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="taxProfileTd1OtherApprovedAnnual"
            >
              TD1 other approved deductions (annual TTD)
            </label>
            <Input
              id="taxProfileTd1OtherApprovedAnnual"
              name="td1OtherApprovedAnnual"
              type="number"
              min={0}
              step={0.01}
              defaultValue={tax.td1OtherApprovedAnnual ?? ""}
              placeholder="Pension, annuity, tax-savings, etc."
            />
            {state.fieldErrors?.td1OtherApprovedAnnual ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.td1OtherApprovedAnnual}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Synced to payroll setup for {tax.taxYear}. Source:{" "}
                {tax.source.replaceAll("_", " ")}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="td1EffectiveDate">
              TD1 effective date
            </label>
            <Input
              id="td1EffectiveDate"
              name="td1EffectiveDate"
              type="date"
              defaultValue={tax.td1EffectiveDate ?? ""}
            />
            {state.fieldErrors?.td1EffectiveDate ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.td1EffectiveDate}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="td1ApprovalReference"
            >
              TD1 / IRD approval reference
            </label>
            <Input
              id="td1ApprovalReference"
              name="td1ApprovalReference"
              defaultValue={tax.td1ApprovalReference ?? ""}
              placeholder="Optional reference"
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="previousEmploymentStatus"
            >
              Previous employment this tax year
            </label>
            <select
              id="previousEmploymentStatus"
              name="previousEmploymentStatus"
              defaultValue={tax.previousEmploymentStatus}
              className="border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm"
            >
              {PREVIOUS_EMPLOYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.previousEmploymentStatus ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.previousEmploymentStatus}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Unknown means prior income is not assumed zero — review before
                posting.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="otherEmolumentIncomeStatus"
            >
              Other emoluments (same tax year)
            </label>
            <select
              id="otherEmolumentIncomeStatus"
              name="otherEmolumentIncomeStatus"
              defaultValue={tax.otherEmolumentIncomeStatus}
              className="border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm"
            >
              {OTHER_EMOLUMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex min-w-0 items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="td1Submitted"
              className="mt-0.5 shrink-0"
              defaultChecked={tax.td1Submitted}
            />
            <span className="min-w-0 text-pretty">TD1 submitted</span>
          </label>
          <label className="flex min-w-0 items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="td1ApprovedByIrd"
              className="mt-0.5 shrink-0"
              defaultChecked={tax.td1ApprovedByIrd}
            />
            <span className="min-w-0 text-pretty">TD1 approved by IRD</span>
          </label>
          <label className="flex min-w-0 items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="cumulativeCalculationEnabled"
              className="mt-0.5 shrink-0"
              defaultChecked={tax.cumulativeCalculationEnabled}
            />
            <span className="min-w-0 text-pretty">
              Cumulative calculation enabled
            </span>
          </label>
          <label className="flex min-w-0 items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="previousEmploymentVerified"
              className="mt-0.5 shrink-0"
              defaultChecked={tax.previousEmploymentVerified}
            />
            <span className="min-w-0 text-pretty">
              Previous employment verified
            </span>
          </label>
          <label className="flex min-w-0 items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="birDirectionPresent"
              className="mt-0.5 shrink-0"
              defaultChecked={tax.birDirectionPresent}
            />
            <span className="min-w-0 text-pretty">BIR direction present</span>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="birDirectionReference"
            >
              BIR direction reference
            </label>
            <Input
              id="birDirectionReference"
              name="birDirectionReference"
              defaultValue={tax.birDirectionReference ?? ""}
              placeholder="Optional BIR direction / instruction ref"
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="previousEmploymentSource"
            >
              Previous employment source
            </label>
            <Input
              id="previousEmploymentSource"
              name="previousEmploymentSource"
              defaultValue={tax.previousEmploymentSource ?? ""}
              placeholder="e.g. TD4 / prior employer letter"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="taxProfileNotes">
              Notes
            </label>
            <Textarea
              id="taxProfileNotes"
              name="notes"
              rows={3}
              defaultValue={tax.notes ?? ""}
              placeholder="Tax treatment notes for this year"
            />
          </div>
        </div>
      </form>
    </PageShell>
  );
}
