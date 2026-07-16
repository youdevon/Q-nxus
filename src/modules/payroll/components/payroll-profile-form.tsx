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
  savePayrollProfile,
  type PayrollProfileFormState,
} from "@/src/modules/payroll/actions/save-payroll-profile";
import { FinancialInstitutionSelect } from "@/src/modules/payroll/components/financial-institution-select";
import type { EmployeePayrollSetup } from "@/src/modules/payroll/lib/payroll-setup-types";
import {
  OTHER_FINANCIAL_INSTITUTION_ID,
  findTtFinancialInstitutionByName,
} from "@/src/modules/payroll/lib/tt-financial-institutions";

const initialState: PayrollProfileFormState = {
  status: "idle",
  message: "",
};

type BankAccountRow = {
  rowId: string;
  /** Select value: institution id, or `other`. Empty when unset. */
  institutionId: string;
  /** Official institution name (or custom text when Other). */
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  isPrimary: boolean;
};

function resolveInstitutionSelection(bankName: string): {
  institutionId: string;
  bankName: string;
} {
  const trimmed = bankName.trim();
  if (!trimmed) {
    return { institutionId: "", bankName: "" };
  }

  const match = findTtFinancialInstitutionByName(trimmed);
  if (match) {
    return { institutionId: match.id, bankName: match.name };
  }

  return {
    institutionId: OTHER_FINANCIAL_INSTITUTION_ID,
    bankName: trimmed,
  };
}

function newBankAccount(isPrimary: boolean): BankAccountRow {
  return {
    rowId: crypto.randomUUID(),
    institutionId: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    accountName: "",
    amount: "",
    isPrimary,
  };
}

export function PayrollProfileForm({
  setup,
}: {
  setup: EmployeePayrollSetup;
}) {
  const [state, formAction, pending] = useActionState(
    savePayrollProfile,
    initialState,
  );

  const [paymentMethod, setPaymentMethod] = useState<string>(
    setup.profile?.paymentMethod ?? "BANK_TRANSFER",
  );

  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>(
    setup.bankAccounts.length > 0
      ? setup.bankAccounts.map((account) => {
          const selection = resolveInstitutionSelection(account.bankName);
          return {
            rowId: account.id,
            institutionId: selection.institutionId,
            bankName: selection.bankName,
            branchName: account.branchName ?? "",
            accountNumber: account.accountNumber,
            accountName: account.accountName ?? "",
            amount: account.amount ?? "",
            isPrimary: account.isPrimary,
          };
        })
      : [newBankAccount(true)],
  );

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

  const showBankSection = paymentMethod === "BANK_TRANSFER";
  const profileHref = `/people/employees/${setup.employee.id}`;
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
          bankName: row.bankName.trim(),
          branchName: row.branchName.trim() || null,
          accountNumber: row.accountNumber.trim(),
          accountName: row.accountName.trim() || null,
          amount: row.isPrimary
            ? null
            : row.amount.trim() === ""
              ? null
              : Number(row.amount),
          isPrimary: row.isPrimary,
        }))
      : [],
  );

  return (
    <form action={formAction}>
      <PageShell>
        <input type="hidden" name="employeeId" value={setup.employee.id} />
        <input type="hidden" name="bankAccountsJson" value={bankAccountsJson} />

        <PageHeader
          title="Payroll Setup"
          description={`${setup.employee.displayName} · ${setup.employee.employeeNumber}`}
          backHref={profileHref}
          backLabel="Employee profile"
          actions={
            <FormPageActions cancelHref={profileHref}>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${setup.employee.id}/payroll/payslip`}
                  />
                }
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
          <section className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium">Blocking issues</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
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
                defaultValue={setup.profile?.payFrequency ?? "MONTHLY"}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Biweekly</option>
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
              <Input
                id="nisNumber"
                name="nisNumber"
                defaultValue={setup.profile?.nisNumber ?? ""}
                placeholder="National insurance number"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="birNumber">
                BIR number
              </label>
              <Input
                id="birNumber"
                name="birNumber"
                defaultValue={setup.profile?.birNumber ?? ""}
                placeholder="Board of Inland Revenue file number"
              />
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
                deduction cap.
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
              /mo from current contract base salary only. Allowances remain part
              of gross pay but are excluded in Phase 1.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">NIS (employee)</p>
                <p className="mt-1 text-sm font-medium">
                  {setup.statutoryPreview.nis
                    ? setup.statutoryPreview.nis.belowMinimum
                      ? "Below Class I — none"
                      : `Class ${setup.statutoryPreview.nis.classCode}: ${formatMoney(setup.statutoryPreview.nis.employeeMonthly, { currency: "TTD" })}/mo`
                    : "No NIS classes configured"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">PAYE</p>
                <p className="mt-1 text-sm font-medium">
                  {setup.statutoryPreview.paye
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
                <SectionHeading>Bank accounts</SectionHeading>
                <Badge variant={primaryCount === 1 ? "success" : "warning"}>
                  {primaryCount === 1
                    ? "Primary remainder set"
                    : "Primary required"}
                </Badge>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setBankAccounts((rows) => [
                    ...rows,
                    newBankAccount(rows.length === 0),
                  ])
                }
              >
                <Plus />
                Add bank account
              </Button>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              Mark one account as primary — it receives the remainder after
              fixed amounts on other accounts. Secondary accounts take a fixed{" "}
              {currency} amount each pay period.
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
                <p className="text-sm font-medium">No bank accounts added</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add at least one account for bank transfer payments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bankAccounts.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid gap-4 rounded-md border border-border/70 p-4 md:grid-cols-[minmax(16rem,2fr)_1fr_1fr_1fr_8rem_auto]"
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
                        onChange={({ institutionId, bankName }) =>
                          updateRow(row.rowId, { institutionId, bankName })
                        }
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
                        htmlFor={`branchName-${row.rowId}`}
                      >
                        Branch
                      </label>
                      <Input
                        id={`branchName-${row.rowId}`}
                        value={row.branchName}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            branchName: event.target.value,
                          })
                        }
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
                        htmlFor={`accountName-${row.rowId}`}
                      >
                        Account name
                      </label>
                      <Input
                        id={`accountName-${row.rowId}`}
                        value={row.accountName}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            accountName: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`amount-${row.rowId}`}
                      >
                        Amount ({currency})
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
                          {hasBaseSalary &&
                          Number(row.amount) > baseSalary + Number.EPSILON ? (
                            <p className="text-[11px] text-destructive">
                              Amount exceeds base salary
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
            <div className="divide-y divide-border/70">
              {setup.payElements.map((element, index) => (
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
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="mt-1 text-sm font-medium">
                      {element.frequency}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Taxable</p>
                    <p className="mt-1 text-sm font-medium">
                      {element.isTaxable ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageShell>
    </form>
  );
}
