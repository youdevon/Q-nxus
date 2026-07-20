"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Archive, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import {
  archivePriorEmploymentYtd,
  savePriorEmploymentYtd,
  type PriorEmploymentFormState,
} from "@/src/modules/payroll/actions/manage-prior-employment-ytd";
import type { EmployeePayrollSetup } from "@/src/modules/payroll/lib/payroll-setup-types";

const initialState: PriorEmploymentFormState = {
  status: "idle",
  message: "",
};

const DOCUMENT_TYPES = [
  { value: "TD4", label: "TD4" },
  { value: "PRIOR_EMPLOYER_LETTER", label: "Prior employer letter" },
  { value: "PAYSLIP", label: "Payslip" },
  { value: "OTHER", label: "Other" },
] as const;

type EmployeePriorEmploymentFormProps = {
  setup: EmployeePayrollSetup;
};

export function EmployeePriorEmploymentForm({
  setup,
}: EmployeePriorEmploymentFormProps) {
  const [saveState, saveAction, savePending] = useActionState(
    savePriorEmploymentYtd,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archivePriorEmploymentYtd,
    initialState,
  );
  const prior = setup.priorEmployment;

  useEffect(() => {
    if (saveState.status === "success" && saveState.message) {
      toast.success(saveState.message);
    } else if (saveState.status === "error" && saveState.message) {
      toast.error(saveState.message);
    }
  }, [saveState]);

  useEffect(() => {
    if (archiveState.status === "success" && archiveState.message) {
      toast.success(archiveState.message);
    } else if (archiveState.status === "error" && archiveState.message) {
      toast.error(archiveState.message);
    }
  }, [archiveState]);

  return (
    <PageShell className="pt-0 sm:pt-0 md:pt-0 lg:pt-0">
      <div className="space-y-6">
        <div className="space-y-1">
          <SectionHeading>
            Prior employment YTD · {prior.taxYear}
          </SectionHeading>
          <p className="text-sm text-muted-foreground">
            For mid-year joiners. Leave empty when there is no prior employer
            this tax year. Amounts are stored now and applied in cumulative PAYE
            (Phase 4).
          </p>
        </div>

        {prior.totals.recordCount > 0 ? (
          <div className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Taxable income YTD</p>
              <p className="font-medium">
                {formatMoney(prior.totals.taxableIncomeYtd, { currency: "TTD" })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">PAYE deducted YTD</p>
              <p className="font-medium">
                {formatMoney(prior.totals.payeDeductedYtd, { currency: "TTD" })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">NIS employee YTD</p>
              <p className="font-medium">
                {formatMoney(prior.totals.nisEmployeeYtd, { currency: "TTD" })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Records</p>
              <p className="font-medium">
                {prior.totals.recordCount} ·{" "}
                {prior.totals.allVerified
                  ? "all verified"
                  : `${prior.totals.verifiedCount} verified`}
              </p>
            </div>
          </div>
        ) : null}

        {prior.records.length > 0 ? (
          <div className="space-y-3">
            {prior.records.map((record) => (
              <div
                key={record.id}
                className="space-y-2 rounded-md border p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{record.employerName}</p>
                    <p className="text-xs text-muted-foreground">
                      As of {record.asOfDate}
                      {record.verified ? " · verified" : " · unverified"}
                    </p>
                  </div>
                  <form action={archiveAction}>
                    <input
                      type="hidden"
                      name="employeeId"
                      value={setup.employee.id}
                    />
                    <input type="hidden" name="recordId" value={record.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={archivePending}
                    >
                      <Archive className="size-4" />
                      Archive
                    </Button>
                  </form>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <p>
                    Taxable:{" "}
                    {formatMoney(Number(record.taxableIncomeYtd), {
                      currency: "TTD",
                    })}
                  </p>
                  <p>
                    PAYE:{" "}
                    {formatMoney(Number(record.payeDeductedYtd), {
                      currency: "TTD",
                    })}
                  </p>
                  <p>
                    NIS emp:{" "}
                    {record.nisEmployeeYtd != null
                      ? formatMoney(Number(record.nisEmployeeYtd), {
                          currency: "TTD",
                        })
                      : "—"}
                  </p>
                </div>
                {record.documents.length > 0 ? (
                  <ul className="space-y-1 text-xs">
                    {record.documents.map((doc) => (
                      <li key={doc.id}>
                        <Link
                          href={`/payroll/employees/${setup.employee.id}/prior-employment/${record.id}/documents/${doc.id}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {doc.label ?? doc.fileName} ({doc.documentType})
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No prior-employer YTD on file for {prior.taxYear}. Joiners without
            prior employment this year can proceed without entering anything.
          </p>
        )}

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="employeeId" value={setup.employee.id} />
          <input type="hidden" name="taxYear" value={prior.taxYear} />

          <p className="text-sm font-medium">Add prior employer</p>

          {saveState.status === "error" && saveState.message ? (
            <p className="text-sm text-destructive">{saveState.message}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="employerName">
                Employer name
              </label>
              <Input id="employerName" name="employerName" required />
              {saveState.fieldErrors?.employerName ? (
                <p className="text-xs text-destructive">
                  {saveState.fieldErrors.employerName}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="employerBirNumber">
                Employer BIR number
              </label>
              <Input id="employerBirNumber" name="employerBirNumber" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="asOfDate">
                YTD as-of date
              </label>
              <Input id="asOfDate" name="asOfDate" type="date" required />
              {saveState.fieldErrors?.asOfDate ? (
                <p className="text-xs text-destructive">
                  {saveState.fieldErrors.asOfDate}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="employmentEndDate"
              >
                Employment end date
              </label>
              <Input
                id="employmentEndDate"
                name="employmentEndDate"
                type="date"
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="employmentStartDate"
              >
                Employment start date
              </label>
              <Input
                id="employmentStartDate"
                name="employmentStartDate"
                type="date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="taxableIncomeYtd">
                Taxable income YTD (TTD)
              </label>
              <Input
                id="taxableIncomeYtd"
                name="taxableIncomeYtd"
                type="number"
                min={0}
                step={0.01}
                required
              />
              {saveState.fieldErrors?.taxableIncomeYtd ? (
                <p className="text-xs text-destructive">
                  {saveState.fieldErrors.taxableIncomeYtd}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payeDeductedYtd">
                PAYE deducted YTD (TTD)
              </label>
              <Input
                id="payeDeductedYtd"
                name="payeDeductedYtd"
                type="number"
                min={0}
                step={0.01}
                required
              />
              {saveState.fieldErrors?.payeDeductedYtd ? (
                <p className="text-xs text-destructive">
                  {saveState.fieldErrors.payeDeductedYtd}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="nisEmployeeYtd">
                NIS employee YTD (TTD)
              </label>
              <Input
                id="nisEmployeeYtd"
                name="nisEmployeeYtd"
                type="number"
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="nisEmployerYtd">
                NIS employer YTD (TTD)
              </label>
              <Input
                id="nisEmployerYtd"
                name="nisEmployerYtd"
                type="number"
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="healthSurchargeYtd"
              >
                Health surcharge YTD (TTD)
              </label>
              <Input
                id="healthSurchargeYtd"
                name="healthSurchargeYtd"
                type="number"
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="otherApprovedDeductionsYtd"
              >
                Other approved deductions YTD (TTD)
              </label>
              <Input
                id="otherApprovedDeductionsYtd"
                name="otherApprovedDeductionsYtd"
                type="number"
                min={0}
                step={0.01}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="verified" className="mt-0.5" />
            <span>Amounts verified against source document</span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="documentType">
                Supporting document type
              </label>
              <select
                id="documentType"
                name="documentType"
                defaultValue="TD4"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              >
                {DOCUMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="attachment">
                Upload document (optional)
              </label>
              <Input id="attachment" name="attachment" type="file" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="priorNotes">
                Notes
              </label>
              <Textarea id="priorNotes" name="notes" rows={2} />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={savePending}>
            <Save className="size-4" />
            {savePending ? "Saving…" : "Save prior employment"}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
