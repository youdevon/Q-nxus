"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  FileText,
  Landmark,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import {
  deactivatePaymentInstruction,
  verifyPaymentInstruction,
  type PaymentInstructionLifecycleState,
} from "@/src/modules/payroll/actions/manage-payment-instructions";
import {
  savePayrollProfile,
  type PayrollProfileFormState,
} from "@/src/modules/payroll/actions/save-payroll-profile";
import { FinancialInstitutionSelect } from "@/src/modules/payroll/components/financial-institution-select";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import type { EmployeePayrollSetup } from "@/src/modules/payroll/lib/payroll-setup-types";
import { OTHER_FINANCIAL_INSTITUTION_ID } from "@/src/modules/payroll/lib/tt-financial-institutions";

const initialState: PayrollProfileFormState = {
  status: "idle",
  message: "",
};

const instructionIdle: PaymentInstructionLifecycleState = {
  status: "idle",
  message: "",
};

function InstructionActionForm({
  action,
  children,
  hidden,
}: {
  action: (
    prev: PaymentInstructionLifecycleState,
    formData: FormData,
  ) => Promise<PaymentInstructionLifecycleState>;
  children: React.ReactNode;
  hidden: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, instructionIdle);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    } else if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="inline-flex">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

type PayrollProfileFormProps = {
  setup: EmployeePayrollSetup;
  /** Optional link to the employee tax-year overview (Phase 8). */
  taxYearHref?: string;
  canVerifyInstructions?: boolean;
  canDeactivateInstructions?: boolean;
};

type BankAccountRow = {
  rowId: string;
  /** Select value: DB institution id, catalog key, or `other`. */
  institutionId: string;
  /** Official institution name (or custom text when Other) — ACH ABA label. */
  bankName: string;
  /** ACH ABA / routing when known. */
  routingNumber: string;
  accountNumber: string;
  /** ACH Individual Name */
  accountName: string;
  /** SAVINGS | CHEQUING — ACH Payment Type */
  accountType: "SAVINGS" | "CHEQUING";
  amount: string;
  percentage: string;
  /** Secondary split mode when percentage allocations are enabled. */
  splitMode: "fixed" | "percentage";
  isPrimary: boolean;
};

function resolveInstitutionSelection(
  account: EmployeePayrollSetup["bankAccounts"][number],
  institutions: EmployeePayrollSetup["financialInstitutions"],
): { institutionId: string; bankName: string } {
  if (account.financialInstitutionId) {
    const match = institutions.find(
      (row) => row.id === account.financialInstitutionId,
    );
    if (match) {
      return { institutionId: match.id, bankName: match.displayName };
    }
  }

  const trimmed = account.bankName.trim();
  if (!trimmed) {
    return { institutionId: "", bankName: "" };
  }

  const byName = institutions.find(
    (row) =>
      row.displayName.toLowerCase() === trimmed.toLowerCase() ||
      row.shortName.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byName) {
    return { institutionId: byName.id, bankName: byName.displayName };
  }

  return {
    institutionId: OTHER_FINANCIAL_INSTITUTION_ID,
    bankName: trimmed,
  };
}

function defaultAccountHolderName(setup: EmployeePayrollSetup): string {
  return setup.employee.displayName.trim();
}

function normalizeRowAccountType(
  value: string | null | undefined,
): "SAVINGS" | "CHEQUING" {
  return value === "CHEQUING" || value === "CURRENT" ? "CHEQUING" : "SAVINGS";
}

function newBankAccount(
  isPrimary: boolean,
  defaultHolderName = "",
): BankAccountRow {
  return {
    rowId: crypto.randomUUID(),
    institutionId: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountName: defaultHolderName,
    accountType: "SAVINGS",
    amount: "",
    percentage: "",
    splitMode: "fixed",
    isPrimary,
  };
}

export function PayrollProfileForm({
  setup,
  taxYearHref,
  canVerifyInstructions = false,
  canDeactivateInstructions = false,
}: PayrollProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    savePayrollProfile,
    initialState,
  );

  const institutions = setup.financialInstitutions ?? [];
  const bankingFlags = setup.bankingFlags ?? {
    bankingEnabled: true,
    splitDepositEnabled: true,
    multipleAccountsEnabled: true,
    percentageAllocationEnabled: false,
    postNetSplitEnabled: false,
  };

  const [paymentMethod, setPaymentMethod] = useState<string>(
    setup.profile?.paymentMethod ?? "BANK_TRANSFER",
  );

  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>(
    setup.bankAccounts.length > 0
      ? setup.bankAccounts.map((account) => {
          const selection = resolveInstitutionSelection(account, institutions);
          const hasPercentage =
            account.percentage != null && Number(account.percentage) > 0;
          return {
            rowId: account.id,
            institutionId: selection.institutionId,
            bankName: selection.bankName,
            routingNumber: account.routingNumber?.trim() ?? "",
            accountNumber: account.accountNumber,
            accountName:
              account.accountName?.trim() || defaultAccountHolderName(setup),
            accountType: normalizeRowAccountType(account.accountType),
            amount: account.amount ?? "",
            percentage: account.percentage ?? "",
            splitMode: hasPercentage ? ("percentage" as const) : ("fixed" as const),
            isPrimary: account.isPrimary,
          };
        })
      : [newBankAccount(true, defaultAccountHolderName(setup))],
  );

  const [allowanceTaxable, setAllowanceTaxable] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    for (const element of setup.payElements) {
      if (
        element.source === "CONTRACT_ALLOWANCE" &&
        element.contractAllowanceId
      ) {
        initial[element.contractAllowanceId] = element.isTaxable;
      }
    }
    return initial;
  });

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  function updateRow(rowId: string, changes: Partial<BankAccountRow>) {
    setBankAccounts((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...changes } : row)),
    );
  }

  function setPrimary(rowId: string) {
    setBankAccounts((rows) =>
      rows.map((row) =>
        row.rowId === rowId
          ? { ...row, isPrimary: true, amount: "" }
          : { ...row, isPrimary: false },
      ),
    );
  }

  function removeRow(rowId: string) {
    setBankAccounts((rows) => {
      const remaining = rows.filter((row) => row.rowId !== rowId);
      if (remaining.length > 0 && !remaining.some((row) => row.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true, amount: "" };
      }
      return remaining;
    });
  }

  const showBankSection =
    paymentMethod === "BANK_TRANSFER" && bankingFlags.bankingEnabled;
  const canAddAnotherAccount =
    bankingFlags.multipleAccountsEnabled && bankingFlags.splitDepositEnabled;
  const payrollHref = "/payroll";
  const setupPayslipHref = `/payroll/employees/${setup.employee.id}/payslip`;
  const currency =
    setup.currentContract?.currency ??
    setup.payElements[0]?.currency ??
    "TTD";
  const baseSalaryRaw = setup.currentContract?.baseSalary;
  const baseSalary =
    baseSalaryRaw != null && baseSalaryRaw !== ""
      ? Number(baseSalaryRaw)
      : null;
  const hasBaseSalary =
    baseSalary != null && Number.isFinite(baseSalary) && baseSalary > 0;
  const allocatedTotal = bankAccounts.reduce((sum, row) => {
    if (row.isPrimary) {
      return sum;
    }
    const value = Number(row.amount);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const primaryRemainder = hasBaseSalary
    ? Math.round((baseSalary - allocatedTotal) * 100) / 100
    : null;
  const exceedsSalary =
    hasBaseSalary && allocatedTotal > baseSalary + Number.EPSILON;
  const primaryCount = bankAccounts.filter((row) => row.isPrimary).length;

  const bankAccountsJson = JSON.stringify(
    showBankSection
      ? bankAccounts.map((row) => ({
          financialInstitutionId: row.institutionId || null,
          bankName: row.bankName.trim(),
          branchName: null,
          accountNumber: row.accountNumber.trim(),
          accountName: row.accountName.trim() || null,
          accountType: row.accountType,
          routingNumber: row.routingNumber.trim() || null,
          amount:
            row.isPrimary || row.splitMode === "percentage"
              ? null
              : row.amount.trim() === ""
                ? null
                : Number(row.amount),
          percentage:
            row.isPrimary || row.splitMode === "fixed"
              ? null
              : row.percentage.trim() === ""
                ? null
                : Number(row.percentage),
          isPrimary: row.isPrimary,
        }))
      : [],
  );

  const allowanceTaxableJson = JSON.stringify(allowanceTaxable);
  const hasEditableAllowances = Object.keys(allowanceTaxable).length > 0;

  return (
    <>
    <form action={formAction}>
      <PageShell>
        <PayrollNav />
        <input type="hidden" name="employeeId" value={setup.employee.id} />
        <input type="hidden" name="bankAccountsJson" value={bankAccountsJson} />
        <input
          type="hidden"
          name="allowanceTaxableJson"
          value={allowanceTaxableJson}
        />

        <PageHeader
          title="Payroll Setup"
          description={`${setup.employee.displayName} · ${setup.employee.employeeNumber}`}
          backHref={payrollHref}
          backLabel="Payroll"
          actions={
            <FormPageActions cancelHref={payrollHref}>
              {taxYearHref ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={taxYearHref} />}
                >
                  Tax year
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={setupPayslipHref} />}
              >
                <FileText />
                View payslip
              </Button>
              <Button
                type="submit"
                disabled={pending || (showBankSection && exceedsSalary)}
              >
                <Save />
                {pending ? "Saving…" : "Save payroll setup"}
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

        <section className="flex flex-wrap items-center gap-2">
          {setup.readiness.isReady ? (
            <Badge variant="success">
              <CircleCheck />
              Payroll ready
            </Badge>
          ) : (
            <Badge variant="warning">
              <CircleAlert />
              Not payroll ready
            </Badge>
          )}
        </section>

        {!setup.readiness.isReady &&
        setup.readiness.blockingIssues.length > 0 ? (
          <section className="rounded-md border border-warning/30 bg-warning/10 p-4 dark:border-warning/40 dark:bg-warning/15">
            <p className="text-sm font-medium text-warning-foreground dark:text-warning">
              Blocking issues
            </p>
            <ul className="mt-2 space-y-1 text-sm text-warning-foreground dark:text-warning/95">
              {setup.readiness.blockingIssues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <SectionHeading>Payroll assignment</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payFrequency">
                Pay frequency
              </label>
              <select
                id="payFrequency"
                name="payFrequency"
                defaultValue={
                  setup.profile?.payFrequency === "BIWEEKLY"
                    ? "FORTNIGHTLY"
                    : (setup.profile?.payFrequency ?? "MONTHLY")
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="FORTNIGHTLY">Fortnightly / Biweekly</option>
                <option value="WEEKLY">Weekly</option>
                <option value="SEMI_MONTHLY">Semi-monthly</option>
              </select>
              {state.fieldErrors?.payFrequency && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.payFrequency}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="paymentMethod">
                Payment method
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
              {state.fieldErrors?.paymentMethod && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.paymentMethod}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="nisNumber">
                NIS number
              </label>
              {setup.employee.nisNumber ? (
                <>
                  <Input
                    id="nisNumber"
                    value={setup.employee.nisNumber}
                    readOnly
                    className="bg-muted"
                  />
                  <input
                    type="hidden"
                    name="nisNumber"
                    value={setup.employee.nisNumber}
                  />
                  <p className="text-xs text-muted-foreground">
                    From the employee record — edit on the employee profile.
                  </p>
                </>
              ) : (
                <>
                  <Input
                    id="nisNumber"
                    name="nisNumber"
                    defaultValue={setup.statutoryNumbers.nisNumber ?? ""}
                    placeholder="National insurance number"
                  />
                  <p className="text-xs text-muted-foreground">
                    Not on the employee record yet. Saving writes this to the
                    employee profile when you have people.manage.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="birNumber">
                BIR number
              </label>
              {setup.employee.birNumber ? (
                <>
                  <Input
                    id="birNumber"
                    value={setup.employee.birNumber}
                    readOnly
                    className="bg-muted"
                  />
                  <input
                    type="hidden"
                    name="birNumber"
                    value={setup.employee.birNumber}
                  />
                  <p className="text-xs text-muted-foreground">
                    From the employee record — edit on the employee profile.
                  </p>
                </>
              ) : (
                <>
                  <Input
                    id="birNumber"
                    name="birNumber"
                    defaultValue={setup.statutoryNumbers.birNumber ?? ""}
                    placeholder="Board of Inland Revenue file number"
                  />
                  <p className="text-xs text-muted-foreground">
                    Not on the employee record yet. Saving writes this to the
                    employee profile when you have people.manage.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="td1OtherApprovedAnnual"
              >
                TD1 other approved deductions (annual TTD)
              </label>
              <Input
                id="td1OtherApprovedAnnual"
                name="td1OtherApprovedAnnual"
                type="number"
                min={0}
                step={0.01}
                defaultValue={setup.profile?.td1OtherApprovedAnnual ?? ""}
                placeholder="Pension, annuity, tax-savings, etc."
              />
              {state.fieldErrors?.td1OtherApprovedAnnual && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.td1OtherApprovedAnnual}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Combined with 70% of employee NIS under the PAYE approved-
                deduction cap. Synced with the {setup.taxProfile.taxYear} tax
                profile below.
              </p>
            </div>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                name="pensionOnlyIncome"
                defaultChecked={setup.profile?.pensionOnlyIncome ?? false}
              />
              Pension is only source of income (Health Surcharge exempt)
            </label>

            <div className="space-y-3 md:col-span-2">
              <p className="text-sm font-medium">Statutory exemptions</p>
              <p className="text-xs text-muted-foreground">
                Opt this employee out of specific statutory deductions. Exempt
                flags also relax payroll readiness (NIS number / BIR number)
                where applicable.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="exemptFromNis"
                    className="mt-0.5"
                    defaultChecked={setup.profile?.exemptFromNis ?? false}
                  />
                  <span>
                    <span className="font-medium">Exempt from NIS</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      No employee or employer NIS. NIS number not required for
                      readiness.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="exemptFromHealthSurcharge"
                    className="mt-0.5"
                    defaultChecked={
                      setup.profile?.exemptFromHealthSurcharge ?? false
                    }
                  />
                  <span>
                    <span className="font-medium">
                      Exempt from Health Surcharge
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Health Surcharge calculates as zero for this employee.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="exemptFromPaye"
                    className="mt-0.5"
                    defaultChecked={setup.profile?.exemptFromPaye ?? false}
                  />
                  <span>
                    <span className="font-medium">Exempt from PAYE</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      No PAYE deducted. BIR number not required for readiness.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="notes">
                Notes
              </label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={setup.profile?.notes ?? ""}
              />
            </div>
          </div>
        </section>

        {setup.statutoryPreview ? (
          <section className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium">Estimated statutory deductions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on taxable pay{" "}
              {formatMoney(setup.statutoryPreview.monthlyTaxableEarnings, {
                currency,
              })}
              /mo from current contract base salary plus taxable allowances.
              Non-taxable allowances remain in gross pay only.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">NIS (employee)</p>
                <p className="mt-1 text-sm font-medium">
                  {setup.profile?.exemptFromNis
                    ? "Exempt (opt-out)"
                    : setup.statutoryPreview.nis
                      ? setup.statutoryPreview.nis.belowMinimum
                        ? "Below Class I — none"
                        : `Class ${setup.statutoryPreview.nis.classCode}: ${formatMoney(setup.statutoryPreview.nis.employeeMonthly, { currency: "TTD" })}/mo`
                      : "No NIS classes configured"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">PAYE</p>
                <p className="mt-1 text-sm font-medium">
                  {setup.profile?.exemptFromPaye
                    ? "Exempt (opt-out)"
                    : setup.statutoryPreview.paye
                      ? `${formatMoney(setup.statutoryPreview.paye.monthlyPaye, { currency: "TTD" })}/mo`
                      : "No PAYE config"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Health Surcharge</p>
                <p className="mt-1 text-sm font-medium">
                  {setup.statutoryPreview.health
                    ? setup.statutoryPreview.health.exempt
                      ? `Exempt (${setup.statutoryPreview.health.exemptionReason?.replaceAll("_", " ").toLowerCase()})`
                      : `${formatMoney(setup.statutoryPreview.health.averageMonthlyAmount, { currency: "TTD" })}/mo avg (${formatMoney(setup.statutoryPreview.health.weeklyAmount)}/wk)`
                    : "No Health config"}
                </p>
              </div>
            </div>

            {!setup.employee.dateOfBirth ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Employee date of birth is not set — Health Surcharge age
                exemptions cannot be applied until DOB is captured on the
                employee record.
              </p>
            ) : null}
          </section>
        ) : null}

        {showBankSection ? (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                <SectionHeading>Payment instructions</SectionHeading>
                <Badge variant={primaryCount === 1 ? "success" : "warning"}>
                  {primaryCount === 1
                    ? "Primary remainder set"
                    : "Primary required"}
                </Badge>
              </div>

              {canAddAnotherAccount ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBankAccounts((rows) => [
                      ...rows,
                      newBankAccount(
                        rows.length === 0,
                        defaultAccountHolderName(setup),
                      ),
                    ])
                  }
                >
                  <Plus />
                  Add destination
                </Button>
              ) : null}
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              Fields align with First Citizens ACH entry: account holder
              (Individual Name), ABA/routing when known, account number, and
              Savings/Chequing (Payment Type). Employee number is used as
              Individual ID from HR. Purpose Code and Addenda are set on the
              bank export profile / batch — not per employee. Branch is not
              required for ACH.{" "}
              {canAddAnotherAccount
                ? `Mark one destination as primary — it receives the remainder after fixed amounts. Changing instructions after a posted run is prepared does not rewrite frozen payments.`
                : "Split deposits are disabled — one FULL_BALANCE destination only."}
            </p>

            {hasBaseSalary ? (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Reference base salary
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {formatMoney(baseSalary, { currency })}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        (current contract)
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Allocated {formatMoney(allocatedTotal, { currency })}
                    </Badge>
                    <Badge
                      variant={
                        exceedsSalary
                          ? "warning"
                          : primaryRemainder != null && primaryRemainder >= 0
                            ? "success"
                            : "outline"
                      }
                    >
                      Remainder{" "}
                      {formatMoney(primaryRemainder ?? 0, { currency })}
                    </Badge>
                  </div>
                </div>
                {exceedsSalary ? (
                  <p className="mt-2 text-xs text-destructive">
                    Fixed secondary amounts exceed base salary. Reduce them so
                    the primary remainder is at least zero.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium">
                  No base salary available
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a current active contract with a base salary to
                  auto-calculate the primary remainder from secondary
                  amounts.
                </p>
              </div>
            )}

            {state.fieldErrors?.bankAccounts && (
              <p className="mb-3 text-xs text-destructive">
                {state.fieldErrors.bankAccounts}
              </p>
            )}

            {bankAccounts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium">No payment instructions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add at least one destination for bank transfer / ACH payments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bankAccounts.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid gap-4 rounded-md border border-border/70 p-4 md:grid-cols-[minmax(12rem,1.4fr)_minmax(8rem,0.9fr)_minmax(10rem,1.1fr)_1fr_1fr_8rem_auto]"
                  >
                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`institution-${row.rowId}`}
                      >
                        Bank / institution
                      </label>
                      <FinancialInstitutionSelect
                        id={`institution-${row.rowId}`}
                        institutionId={row.institutionId}
                        bankName={row.bankName}
                        institutions={institutions}
                        onChange={({ institutionId, bankName }) => {
                          const match = institutions.find(
                            (item) =>
                              item.id === institutionId ||
                              item.catalogKey === institutionId,
                          );
                          const fromInstitution =
                            match?.routingCode?.trim() ||
                            match?.achParticipantCode?.trim() ||
                            "";
                          updateRow(row.rowId, {
                            institutionId,
                            bankName,
                            routingNumber:
                              institutionId === OTHER_FINANCIAL_INSTITUTION_ID
                                ? row.routingNumber
                                : fromInstitution || row.routingNumber,
                          });
                        }}
                      />
                      {row.institutionId === OTHER_FINANCIAL_INSTITUTION_ID ? (
                        <Input
                          id={`bankName-${row.rowId}`}
                          value={row.bankName}
                          onChange={(event) =>
                            updateRow(row.rowId, {
                              bankName: event.target.value,
                            })
                          }
                          placeholder="Institution name"
                          required
                          className="mt-2"
                        />
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`routingNumber-${row.rowId}`}
                      >
                        ABA / routing
                      </label>
                      <Input
                        id={`routingNumber-${row.rowId}`}
                        value={row.routingNumber}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            routingNumber: event.target.value,
                          })
                        }
                        placeholder="When confirmed"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`accountName-${row.rowId}`}
                      >
                        Account holder (Individual Name)
                      </label>
                      <Input
                        id={`accountName-${row.rowId}`}
                        value={row.accountName}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            accountName: event.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`accountNumber-${row.rowId}`}
                      >
                        Account number
                      </label>
                      <Input
                        id={`accountNumber-${row.rowId}`}
                        value={row.accountNumber}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            accountNumber: event.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`accountType-${row.rowId}`}
                      >
                        Account type (Payment Type)
                      </label>
                      <select
                        id={`accountType-${row.rowId}`}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={row.accountType}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            accountType:
                              event.target.value === "CHEQUING"
                                ? "CHEQUING"
                                : "SAVINGS",
                          })
                        }
                        required
                      >
                        <option value="SAVINGS">Savings → Savings Credit</option>
                        <option value="CHEQUING">
                          Chequing → Checking Credit
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`amount-${row.rowId}`}
                      >
                        {row.isPrimary
                          ? `Remainder (${currency})`
                          : bankingFlags.percentageAllocationEnabled &&
                              row.splitMode === "percentage"
                            ? "Percentage (%)"
                            : `Amount (${currency})`}
                      </label>
                      {row.isPrimary ? (
                        <div className="space-y-1">
                          <Input
                            id={`amount-${row.rowId}`}
                            value={
                              hasBaseSalary && primaryRemainder != null
                                ? primaryRemainder.toFixed(2)
                                : "Remainder"
                            }
                            disabled
                            readOnly
                            aria-invalid={
                              primaryRemainder != null && primaryRemainder < 0
                            }
                            className={
                              primaryRemainder != null && primaryRemainder < 0
                                ? "text-destructive"
                                : undefined
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {hasBaseSalary
                              ? "Auto: salary − secondary amounts"
                              : "Remainder of pay (no salary to calculate)"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {bankingFlags.percentageAllocationEnabled ? (
                            <div className="mb-1 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  row.splitMode === "fixed"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  updateRow(row.rowId, {
                                    splitMode: "fixed",
                                    percentage: "",
                                  })
                                }
                              >
                                Fixed
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  row.splitMode === "percentage"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  updateRow(row.rowId, {
                                    splitMode: "percentage",
                                    amount: "",
                                  })
                                }
                              >
                                %
                              </Button>
                            </div>
                          ) : null}
                          {row.splitMode === "percentage" &&
                          bankingFlags.percentageAllocationEnabled ? (
                            <Input
                              id={`amount-${row.rowId}`}
                              type="number"
                              min={0.01}
                              max={100}
                              step={0.01}
                              value={row.percentage}
                              onChange={(event) =>
                                updateRow(row.rowId, {
                                  percentage: event.target.value,
                                })
                              }
                              required
                            />
                          ) : (
                            <Input
                              id={`amount-${row.rowId}`}
                              type="number"
                              min={0.01}
                              max={hasBaseSalary ? baseSalary : undefined}
                              step={0.01}
                              value={row.amount}
                              onChange={(event) =>
                                updateRow(row.rowId, {
                                  amount: event.target.value,
                                })
                              }
                              required
                              aria-invalid={exceedsSalary}
                            />
                          )}
                          {hasBaseSalary &&
                          row.splitMode === "fixed" &&
                          Number(row.amount) > baseSalary + Number.EPSILON ? (
                            <p className="text-[11px] text-destructive">
                              Amount exceeds base salary
                            </p>
                          ) : null}
                          {bankingFlags.percentageAllocationEnabled &&
                          !bankingFlags.postNetSplitEnabled ? (
                            <p className="text-[11px] text-muted-foreground">
                              % splits apply when POST_NET_SPLIT_ENABLED is on.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex items-end gap-2 pb-0.5">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="primaryBankRow"
                          checked={row.isPrimary}
                          onChange={() => setPrimary(row.rowId)}
                        />
                        Primary
                      </label>

                      {(() => {
                        const live = setup.bankAccounts.find(
                          (account) => account.id === row.rowId,
                        );
                        if (!live) {
                          return null;
                        }
                        return (
                          <Badge
                            variant={
                              live.isVerified ||
                              live.verificationStatus === "VERIFIED"
                                ? "success"
                                : live.verificationStatus === "FAILED"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {live.verificationStatus ?? "UNVERIFIED"}
                          </Badge>
                        );
                      })()}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove bank account"
                        onClick={() => removeRow(row.rowId)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <SectionHeading>Pay elements (from current contract)</SectionHeading>
          </div>

          {setup.payElements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No current active contract — pay elements will appear when a
              contract with a base salary is in place.
            </p>
          ) : (
            <>
              {hasEditableAllowances ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  Toggle Taxable on allowances to update the current contract.
                  Taxable allowances are included in NIS/PAYE taxable pay;
                  non-taxable remain in gross only. Amount and frequency are
                  edited on the contract.
                </p>
              ) : null}

              <div className="divide-y divide-border/70">
                {setup.payElements.map((element, index) => {
                  const allowanceId = element.contractAllowanceId ?? null;
                  const canEditTaxable =
                    element.source === "CONTRACT_ALLOWANCE" &&
                    allowanceId != null;

                  return (
                    <div
                      key={`${element.label}-${index}`}
                      className="grid gap-4 py-4 md:grid-cols-[1fr_10rem_8rem_8rem]"
                    >
                      <div>
                        <p className="text-sm font-medium">{element.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {element.source === "CONTRACT_SALARY"
                            ? "Contract base salary"
                            : "Contract allowance"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="mt-1 text-sm font-medium">
                          {formatMoney(element.amount, {
                            currency: element.currency,
                          })}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Frequency
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {element.frequency}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Taxable</p>
                        {canEditTaxable ? (
                          <label className="mt-1 flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={
                                allowanceTaxable[allowanceId] ??
                                element.isTaxable
                              }
                              onChange={(event) =>
                                setAllowanceTaxable((current) => ({
                                  ...current,
                                  [allowanceId]: event.target.checked,
                                }))
                              }
                            />
                            Taxable
                          </label>
                        ) : (
                          <p className="mt-1 text-sm font-medium">Yes</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </PageShell>
    </form>

    {(canVerifyInstructions ||
      canDeactivateInstructions ||
      setup.bankAccountHistory.length > 0) && (
      <PageShell className="pt-0 sm:pt-0 md:pt-0 lg:pt-0">
        {(canVerifyInstructions || canDeactivateInstructions) &&
        setup.bankAccounts.length > 0 ? (
          <section className="mb-10">
            <SectionHeading>Verify / deactivate instructions</SectionHeading>
            <p className="mt-1 text-xs text-muted-foreground">
              Verification is separate from save. Deactivate soft-closes an
              instruction and retains history — it does not hard-delete.
            </p>
            <div className="mt-4 space-y-3">
              {setup.bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {account.bankName} · {account.accountNumberLastFour
                        ? `••••${account.accountNumberLastFour}`
                        : "••••"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.verificationStatus ?? "UNVERIFIED"}
                      {account.dataSource ? ` · ${account.dataSource}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canVerifyInstructions &&
                    account.verificationStatus !== "VERIFIED" ? (
                      <InstructionActionForm
                        action={verifyPaymentInstruction}
                        hidden={{
                          accountId: account.id,
                          employeeId: setup.employee.id,
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Verify
                        </Button>
                      </InstructionActionForm>
                    ) : null}
                    {canDeactivateInstructions ? (
                      <InstructionActionForm
                        action={deactivatePaymentInstruction}
                        hidden={{
                          accountId: account.id,
                          employeeId: setup.employee.id,
                          changeReason: "Deactivated from payroll setup UI",
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Deactivate
                        </Button>
                      </InstructionActionForm>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {setup.bankAccountHistory.length > 0 ? (
          <section className="mb-10">
            <SectionHeading>Instruction history</SectionHeading>
            <p className="mt-1 text-xs text-muted-foreground">
              Soft-deactivated and superseded payment instructions (retained for
              audit).
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Bank</th>
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Effective</th>
                    <th className="py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.bankAccountHistory.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4">{row.bankName}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {row.accountNumberMasked}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary">
                          {row.verificationStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">{row.dataSource}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {row.effectiveFrom.slice(0, 10)}
                        {row.archivedAt
                          ? ` → ${row.archivedAt.slice(0, 10)}`
                          : ""}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {row.changeReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </PageShell>
    )}
  </>
  );
}
