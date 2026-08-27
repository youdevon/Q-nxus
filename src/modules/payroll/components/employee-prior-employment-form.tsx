"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, X } from "lucide-react";
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
import type {
  EmployeePayrollSetup,
  PriorEmploymentYtdSetup,
} from "@/src/modules/payroll/lib/payroll-setup-types";
import {
  PRIOR_PAYSLIP_FIELD_HINTS,
  resolvePriorTaxableFromPayslip,
  validatePriorPayslipWorksheet,
  type PriorTaxableIncomeEntryMode,
} from "@/src/modules/payroll/lib/prior-payslip-worksheet";

const initialState: PriorEmploymentFormState = {
  status: "idle",
  message: "",
};

const DOCUMENT_TYPES = [
  { value: "PAYSLIP", label: "Payslip" },
  { value: "TD4", label: "TD4" },
  { value: "PRIOR_EMPLOYER_LETTER", label: "Prior employer letter" },
  { value: "OTHER", label: "Other" },
] as const;

type EmployeePriorEmploymentFormProps = {
  setup: EmployeePayrollSetup;
};

function parseOptionalAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function FieldHint({ children }: { children: string }) {
  return <p className="text-pretty text-xs text-muted-foreground">{children}</p>;
}

export function EmployeePriorEmploymentForm({
  setup,
}: EmployeePriorEmploymentFormProps) {
  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(
    savePriorEmploymentYtd,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archivePriorEmploymentYtd,
    initialState,
  );
  const [editingRecord, setEditingRecord] =
    useState<PriorEmploymentYtdSetup | null>(null);
  const prior = setup.priorEmployment;
  const isEditing = editingRecord != null;

  const [entryMode, setEntryMode] = useState<PriorTaxableIncomeEntryMode>(
    editingRecord?.taxableIncomeEntryMode ?? "DIRECT",
  );
  const [grossEarningsYtd, setGrossEarningsYtd] = useState(
    editingRecord?.grossEarningsYtd ?? "",
  );
  const [nonTaxableAllowancesYtd, setNonTaxableAllowancesYtd] = useState(
    editingRecord?.nonTaxableAllowancesYtd ?? "",
  );
  const [taxableIncomeYtd, setTaxableIncomeYtd] = useState(
    editingRecord?.taxableIncomeYtd ?? "",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (saveState.status === "success" && saveState.message) {
      toast.success(saveState.message);
      setEditingRecord(null);
      setEntryMode("DIRECT");
      setGrossEarningsYtd("");
      setNonTaxableAllowancesYtd("");
      setTaxableIncomeYtd("");
      setShowAdvanced(false);
      router.refresh();
    } else if (saveState.status === "error" && saveState.message) {
      toast.error(saveState.message);
    }
  }, [saveState, router]);

  useEffect(() => {
    if (archiveState.status === "success" && archiveState.message) {
      toast.success(archiveState.message);
      router.refresh();
    } else if (archiveState.status === "error" && archiveState.message) {
      toast.error(archiveState.message);
    }
  }, [archiveState, router]);

  // Drop edit mode when the target row disappears after delete/revalidation
  // (adjust state during render — avoids a third useEffect).
  if (
    editingRecord != null &&
    !prior.records.some((record) => record.id === editingRecord.id)
  ) {
    setEditingRecord(null);
  }

  const formKey = editingRecord?.id ?? "new-prior-employment";

  const worksheetPreview = useMemo(() => {
    return resolvePriorTaxableFromPayslip({
      entryMode,
      taxableIncomeYtd: parseOptionalAmount(taxableIncomeYtd),
      grossEarningsYtd: parseOptionalAmount(grossEarningsYtd),
      nonTaxableAllowancesYtd: parseOptionalAmount(nonTaxableAllowancesYtd),
    });
  }, [entryMode, taxableIncomeYtd, grossEarningsYtd, nonTaxableAllowancesYtd]);

  const worksheetWarnings = useMemo(
    () => validatePriorPayslipWorksheet(worksheetPreview),
    [worksheetPreview],
  );

  function beginEdit(record: PriorEmploymentYtdSetup) {
    setEditingRecord(record);
    setEntryMode(record.taxableIncomeEntryMode ?? "DIRECT");
    setGrossEarningsYtd(record.grossEarningsYtd ?? "");
    setNonTaxableAllowancesYtd(record.nonTaxableAllowancesYtd ?? "");
    setTaxableIncomeYtd(record.taxableIncomeYtd ?? "");
    setShowAdvanced(
      Boolean(record.nisEmployerYtd || record.otherApprovedDeductionsYtd),
    );
    document.getElementById("prior-employment-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function beginCreate() {
    setEditingRecord(null);
    setEntryMode("DIRECT");
    setGrossEarningsYtd("");
    setNonTaxableAllowancesYtd("");
    setTaxableIncomeYtd("");
    setShowAdvanced(false);
  }

  return (
    <PageShell size="lg" className="min-w-0 pt-0 sm:pt-0 md:pt-0 lg:pt-0">
      <div className="min-w-0 space-y-6">
        <div className="min-w-0 space-y-1">
          <SectionHeading>
            Prior employment YTD · {prior.taxYear}
          </SectionHeading>
          <p className="text-pretty text-sm text-muted-foreground">
            Enter figures from the employee’s last prior-employer payslip or
            TD4. These amounts feed cumulative PAYE for mid-year joiners. Leave
            empty only when there was no prior employer this tax year.
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">What to take from the payslip</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Taxable YTD</span> — YTD PAY /
              taxable earnings. Not net pay. Not full gross when travelling is
              listed separately.
            </li>
            <li>
              <span className="text-foreground">PAYE / NIS / Health YTD</span> —
              statutory deductions only (ignore loans and voluntary deductions).
            </li>
            <li>
              <span className="text-foreground">As-of date</span> — pay period
              end on that slip.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            {PRIOR_PAYSLIP_FIELD_HINTS.doNotEnter}
          </p>
        </div>

        {prior.totals.recordCount > 0 ? (
          <div className="grid min-w-0 gap-3 rounded-md border p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <p className="text-muted-foreground">Taxable income YTD</p>
              <p className="font-medium text-pretty">
                {formatMoney(prior.totals.taxableIncomeYtd, { currency: "TTD" })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">PAYE deducted YTD</p>
              <p className="font-medium text-pretty">
                {formatMoney(prior.totals.payeDeductedYtd, { currency: "TTD" })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">NIS employee YTD</p>
              <p className="font-medium text-pretty">
                {formatMoney(prior.totals.nisEmployeeYtd, { currency: "TTD" })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">Records</p>
              <p className="font-medium text-pretty">
                {prior.totals.recordCount} ·{" "}
                {prior.totals.allVerified
                  ? "all verified"
                  : `${prior.totals.verifiedCount} verified`}
              </p>
              {!prior.totals.allVerified ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Unverified rows are ignored for PAYE until checked.
                </p>
              ) : null}
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
                      {record.taxableIncomeEntryMode === "WORKSHEET"
                        ? " · from gross − allowances"
                        : " · direct taxable"}
                      {editingRecord?.id === record.id ? " · editing" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savePending || archivePending}
                      onClick={() => beginEdit(record)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <form
                      action={archiveAction}
                      onSubmit={(event) => {
                        const confirmed = window.confirm(
                          `Delete prior employment for ${record.employerName}?\n\nIt will no longer count toward YTD totals. The record is archived and purged after retention.`,
                        );
                        if (!confirmed) {
                          event.preventDefault();
                          return;
                        }
                        if (editingRecord?.id === record.id) {
                          setEditingRecord(null);
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="employeeId"
                        value={setup.employee.id}
                      />
                      <input type="hidden" name="recordId" value={record.id} />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={archivePending}
                      >
                        <Trash2 className="size-4" />
                        {archivePending ? "Deleting…" : "Delete"}
                      </Button>
                    </form>
                  </div>
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
                {record.grossEarningsYtd != null ||
                record.nonTaxableAllowancesYtd != null ? (
                  <p className="text-xs text-muted-foreground">
                    Worksheet: gross{" "}
                    {record.grossEarningsYtd != null
                      ? formatMoney(Number(record.grossEarningsYtd), {
                          currency: "TTD",
                        })
                      : "—"}
                    {" − non-taxable "}
                    {record.nonTaxableAllowancesYtd != null
                      ? formatMoney(Number(record.nonTaxableAllowancesYtd), {
                          currency: "TTD",
                        })
                      : "—"}
                  </p>
                ) : null}
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

        <form
          id="prior-employment-form"
          key={formKey}
          action={saveAction}
          className="space-y-4"
        >
          <input type="hidden" name="employeeId" value={setup.employee.id} />
          <input type="hidden" name="taxYear" value={prior.taxYear} />
          <input type="hidden" name="taxableIncomeEntryMode" value={entryMode} />
          {entryMode === "WORKSHEET" ? (
            <input
              type="hidden"
              name="taxableIncomeYtd"
              value={worksheetPreview.taxableIncomeYtd.toFixed(2)}
            />
          ) : null}
          {editingRecord ? (
            <input type="hidden" name="recordId" value={editingRecord.id} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {isEditing ? "Edit prior employer" : "Add prior employer"}
            </p>
            {isEditing ? (
              <Button type="button" variant="ghost" size="sm" onClick={beginCreate}>
                <X className="size-4" />
                Cancel edit
              </Button>
            ) : null}
          </div>

          {saveState.status === "error" && saveState.message ? (
            <p className="text-sm text-destructive">{saveState.message}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="employerName">
                Prior employer name
              </label>
              <Input
                id="employerName"
                name="employerName"
                required
                defaultValue={editingRecord?.employerName ?? ""}
                placeholder="e.g. Tobago Regional Health Authority"
              />
              {saveState.fieldErrors?.employerName ? (
                <p className="text-xs text-destructive">
                  {saveState.fieldErrors.employerName}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="asOfDate">
                YTD as-of date
              </label>
              <Input
                id="asOfDate"
                name="asOfDate"
                type="date"
                required
                defaultValue={editingRecord?.asOfDate ?? ""}
              />
              <FieldHint>{PRIOR_PAYSLIP_FIELD_HINTS.asOfDate}</FieldHint>
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
                defaultValue={editingRecord?.employmentEndDate ?? ""}
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
                defaultValue={editingRecord?.employmentStartDate ?? ""}
              />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">
              Taxable income from the payslip
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="taxableIncomeEntryModeUi"
                  className="mt-1"
                  checked={entryMode === "DIRECT"}
                  onChange={() => setEntryMode("DIRECT")}
                />
                <span>
                  <span className="font-medium">Slip shows taxable / YTD PAY</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Port Authority–style slips with a YTD PAY box, or a TD4
                    taxable total.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="taxableIncomeEntryModeUi"
                  className="mt-1"
                  checked={entryMode === "WORKSHEET"}
                  onChange={() => setEntryMode("WORKSHEET")}
                />
                <span>
                  <span className="font-medium">
                    Slip shows gross + travelling
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    TRHA / RDC–style slips. We subtract non-taxable allowances
                    for you.
                  </span>
                </span>
              </label>
            </div>

            {entryMode === "DIRECT" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="taxableIncomeYtd"
                  >
                    Taxable income YTD (TTD)
                  </label>
                  <Input
                    id="taxableIncomeYtd"
                    name="taxableIncomeYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={taxableIncomeYtd}
                    onChange={(event) => setTaxableIncomeYtd(event.target.value)}
                  />
                  <FieldHint>{PRIOR_PAYSLIP_FIELD_HINTS.taxableIncomeYtd}</FieldHint>
                  {saveState.fieldErrors?.taxableIncomeYtd ? (
                    <p className="text-xs text-destructive">
                      {saveState.fieldErrors.taxableIncomeYtd}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="grossEarningsYtd"
                  >
                    Gross earnings YTD (optional)
                  </label>
                  <Input
                    id="grossEarningsYtd"
                    name="grossEarningsYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={grossEarningsYtd}
                    onChange={(event) => setGrossEarningsYtd(event.target.value)}
                    placeholder="YTD GRS if shown"
                  />
                  <FieldHint>
                    {PRIOR_PAYSLIP_FIELD_HINTS.grossEarningsYtd}
                  </FieldHint>
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="nonTaxableAllowancesYtd"
                  >
                    Non-taxable allowances YTD (optional)
                  </label>
                  <Input
                    id="nonTaxableAllowancesYtd"
                    name="nonTaxableAllowancesYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={nonTaxableAllowancesYtd}
                    onChange={(event) =>
                      setNonTaxableAllowancesYtd(event.target.value)
                    }
                    placeholder="YTD ALL / travelling"
                  />
                  <FieldHint>
                    {PRIOR_PAYSLIP_FIELD_HINTS.nonTaxableAllowancesYtd}
                  </FieldHint>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="grossEarningsYtd"
                  >
                    Gross / total earnings YTD (TTD)
                  </label>
                  <Input
                    id="grossEarningsYtd"
                    name="grossEarningsYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={grossEarningsYtd}
                    onChange={(event) => setGrossEarningsYtd(event.target.value)}
                  />
                  <FieldHint>
                    {PRIOR_PAYSLIP_FIELD_HINTS.grossEarningsYtd}
                  </FieldHint>
                  {saveState.fieldErrors?.grossEarningsYtd ? (
                    <p className="text-xs text-destructive">
                      {saveState.fieldErrors.grossEarningsYtd}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="nonTaxableAllowancesYtd"
                  >
                    Non-taxable allowances YTD (TTD)
                  </label>
                  <Input
                    id="nonTaxableAllowancesYtd"
                    name="nonTaxableAllowancesYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={nonTaxableAllowancesYtd}
                    onChange={(event) =>
                      setNonTaxableAllowancesYtd(event.target.value)
                    }
                    placeholder="0.00"
                  />
                  <FieldHint>
                    {PRIOR_PAYSLIP_FIELD_HINTS.nonTaxableAllowancesYtd}
                  </FieldHint>
                </div>
                <div className="space-y-1 rounded-md bg-muted/50 p-3 md:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Taxable income YTD (computed)
                  </p>
                  <p className="text-sm font-medium">
                    {formatMoney(worksheetPreview.taxableIncomeYtd, {
                      currency: "TTD",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gross − non-taxable allowances. This is what PAYE uses.
                  </p>
                </div>
              </div>
            )}

            {worksheetWarnings.length > 0 ? (
              <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {worksheetWarnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">
              Statutory deductions YTD
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
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
                  defaultValue={editingRecord?.payeDeductedYtd ?? ""}
                />
                <FieldHint>{PRIOR_PAYSLIP_FIELD_HINTS.payeDeductedYtd}</FieldHint>
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
                  defaultValue={editingRecord?.nisEmployeeYtd ?? ""}
                />
                <FieldHint>{PRIOR_PAYSLIP_FIELD_HINTS.nisEmployeeYtd}</FieldHint>
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
                  defaultValue={editingRecord?.healthSurchargeYtd ?? ""}
                />
                <FieldHint>
                  {PRIOR_PAYSLIP_FIELD_HINTS.healthSurchargeYtd}
                </FieldHint>
              </div>
            </div>
          </fieldset>

          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide" : "Show"} optional fields
            </Button>
            {showAdvanced ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="employerBirNumber"
                  >
                    Employer BIR number
                  </label>
                  <Input
                    id="employerBirNumber"
                    name="employerBirNumber"
                    defaultValue={editingRecord?.employerBirNumber ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="nisEmployerYtd"
                  >
                    NIS employer YTD (TTD)
                  </label>
                  <Input
                    id="nisEmployerYtd"
                    name="nisEmployerYtd"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={editingRecord?.nisEmployerYtd ?? ""}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
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
                    defaultValue={
                      editingRecord?.otherApprovedDeductionsYtd ?? ""
                    }
                  />
                  <FieldHint>
                    TD1 other approved amounts from prior employment, if shown.
                  </FieldHint>
                </div>
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="verified"
              className="mt-0.5"
              defaultChecked={editingRecord?.verified ?? false}
            />
            <span>
              Amounts verified against source document
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Required before figures enter cumulative PAYE.
              </span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="documentType">
                Supporting document type
              </label>
              <select
                id="documentType"
                name="documentType"
                defaultValue="PAYSLIP"
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
              {isEditing && (editingRecord?.documents.length ?? 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Existing documents are kept. Upload only to add another.
                </p>
              ) : null}
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="priorNotes">
                Notes
              </label>
              <Textarea
                id="priorNotes"
                name="notes"
                rows={2}
                defaultValue={editingRecord?.notes ?? ""}
                placeholder="e.g. From May 2026 TRHA payslip — travelling excluded from taxable"
              />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={savePending}>
            <Save className="size-4" />
            {savePending
              ? isEditing
                ? "Updating…"
                : "Saving…"
              : isEditing
                ? "Update prior employment"
                : "Save prior employment"}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
