"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { NisContributionCategory } from "@/generated/prisma/enums";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveEmployeeStatutoryWriteFromPayroll } from "@/src/modules/hr/public";
import { OTHER_FINANCIAL_INSTITUTION_ID } from "@/src/modules/payroll/lib/tt-financial-institutions";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import { replaceEmployeeBankSetup } from "@/src/modules/payroll/services/replace-employee-bank-setup";
import { upsertEmployeeTaxProfileTd1Sync } from "@/src/modules/payroll/services/upsert-employee-tax-profile-td1-sync";
import {
  normalizeAchAccountType,
  validateAchEmployeeInstructionFields,
} from "@/src/modules/payroll/lib/ach-employee-fields";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type PayrollProfileFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

const PAY_FREQUENCIES = [
  "MONTHLY",
  "FORTNIGHTLY",
  "WEEKLY",
  "BIWEEKLY",
  "SEMI_MONTHLY",
] as const;

const PAYMENT_METHODS = ["BANK_TRANSFER", "CHEQUE", "CASH"] as const;

const NIS_CATEGORY_OVERRIDES = ["NORMAL", "CLASS_Z", "EXEMPT"] as const satisfies ReadonlyArray<
  NisContributionCategory
>;

type PayFrequency = (typeof PAY_FREQUENCIES)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type NisCategoryOverride = (typeof NIS_CATEGORY_OVERRIDES)[number];

type BankAccountInput = {
  financialInstitutionId: string | null;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  accountType: "SAVINGS" | "CHEQUING";
  /** ACH ABA / routing when known (optional override of institution codes). */
  routingNumber: string | null;
  amount: number | null;
  percentage: number | null;
  isPrimary: boolean;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseBankAccounts(raw: string): BankAccountInput[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const accounts: BankAccountInput[] = [];

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry == null) {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const bankName =
      typeof record.bankName === "string" ? record.bankName.trim() : "";
    const accountNumber =
      typeof record.accountNumber === "string"
        ? record.accountNumber.trim()
        : "";
    const branchName =
      typeof record.branchName === "string" && record.branchName.trim()
        ? record.branchName.trim()
        : null;
    const accountName =
      typeof record.accountName === "string" && record.accountName.trim()
        ? record.accountName.trim()
        : null;
    const accountType = normalizeAchAccountType(
      typeof record.accountType === "string" ? record.accountType : null,
    );
    if (!accountType) {
      return null;
    }
    const routingNumber =
      typeof record.routingNumber === "string" && record.routingNumber.trim()
        ? record.routingNumber.trim()
        : null;
    const isPrimary = record.isPrimary === true;
    const rawInstitutionId =
      typeof record.financialInstitutionId === "string"
        ? record.financialInstitutionId.trim()
        : typeof record.institutionId === "string"
          ? record.institutionId.trim()
          : "";
    const financialInstitutionId =
      !rawInstitutionId ||
      rawInstitutionId === OTHER_FINANCIAL_INSTITUTION_ID
        ? null
        : rawInstitutionId;

    let amount: number | null = null;
    let percentage: number | null = null;

    if (
      record.amount !== null &&
      record.amount !== undefined &&
      record.amount !== ""
    ) {
      const parsedAmount = Number(record.amount);
      if (!Number.isFinite(parsedAmount)) {
        return null;
      }
      amount = parsedAmount;
    }

    if (
      record.percentage !== null &&
      record.percentage !== undefined &&
      record.percentage !== ""
    ) {
      const parsedPercentage = Number(record.percentage);
      if (!Number.isFinite(parsedPercentage)) {
        return null;
      }
      percentage = parsedPercentage;
    }

    accounts.push({
      financialInstitutionId,
      bankName,
      branchName,
      accountNumber,
      accountName,
      accountType,
      routingNumber,
      amount: isPrimary ? null : amount,
      percentage: isPrimary ? null : percentage,
      isPrimary,
    });
  }

  return accounts;
}

/** Parses `{ [allowanceId]: boolean }` from the payroll form. Empty object if absent. */
function parseAllowanceTaxable(
  raw: string,
): Record<string, boolean> | null {
  if (!raw) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
    return null;
  }

  const result: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }
    if (typeof value !== "boolean") {
      return null;
    }
    result[key] = value;
  }

  return result;
}

function validateBankAccounts(
  accounts: BankAccountInput[],
): string | undefined {
  if (accounts.length === 0) {
    return "Add at least one payment instruction for bank transfer.";
  }

  for (const account of accounts) {
    const ach = validateAchEmployeeInstructionFields({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountName,
      accountType: account.accountType,
      financialInstitutionId: account.financialInstitutionId,
    });
    if (!ach.ok) {
      return ach.errors[0];
    }
  }

  const primaryCount = accounts.filter((account) => account.isPrimary).length;

  if (primaryCount !== 1) {
    return "Mark exactly one payment instruction as primary (receives the remainder of net pay).";
  }

  for (const account of accounts) {
    if (account.isPrimary) {
      continue;
    }

    const hasFixed = account.amount != null && account.amount > 0;
    const hasPercentage =
      account.percentage != null &&
      account.percentage > 0 &&
      account.percentage <= 100;

    if (hasFixed && hasPercentage) {
      return "Each secondary instruction needs either a fixed amount or a percentage — not both.";
    }

    if (!hasFixed && !hasPercentage) {
      return "Each secondary payment instruction needs a fixed amount or percentage greater than zero.";
    }
  }

  const percentageTotal = accounts.reduce(
    (sum, account) =>
      account.isPrimary ? sum : sum + Math.max(0, account.percentage ?? 0),
    0,
  );
  if (percentageTotal > 100 + Number.EPSILON) {
    return "Percentage allocations cannot exceed 100%.";
  }

  return undefined;
}

export async function savePayrollProfile(
  _previousState: PayrollProfileFormState,
  formData: FormData,
): Promise<PayrollProfileFormState> {
  const actor = await requireActor("payroll.setup", "payroll.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");

  if (!employeeId) {
    return {
      status: "error",
      message: "Missing employee reference.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  const payFrequencyRaw = textValue(formData, "payFrequency");
  const payFrequency = PAY_FREQUENCIES.includes(
    payFrequencyRaw as PayFrequency,
  )
    ? (payFrequencyRaw as PayFrequency)
    : null;

  if (!payFrequency) {
    fieldErrors.payFrequency = "Select a valid pay frequency.";
  }

  const paymentMethodRaw = textValue(formData, "paymentMethod");
  const paymentMethod = PAYMENT_METHODS.includes(
    paymentMethodRaw as PaymentMethod,
  )
    ? (paymentMethodRaw as PaymentMethod)
    : null;

  if (!paymentMethod) {
    fieldErrors.paymentMethod = "Select a valid payment method.";
  }

  const [
    bankingEnabled,
    chequeEnabled,
    cashEnabled,
    splitDepositEnabled,
    fixedAmountEnabled,
    percentageEnabled,
    remainderEnabled,
    multipleAccountsEnabled,
  ] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.CHEQUE_PAYMENT_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.CASH_PAYMENT_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.SPLIT_DEPOSIT_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.FIXED_AMOUNT_ALLOCATION_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.REMAINDER_ALLOCATION_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED,
    ),
  ]);

  if (paymentMethod === "BANK_TRANSFER" && !bankingEnabled) {
    fieldErrors.paymentMethod =
      "Payroll banking is disabled for this organization.";
  }
  if (paymentMethod === "CHEQUE" && !chequeEnabled) {
    fieldErrors.paymentMethod = "Cheque payments are disabled.";
  }
  if (paymentMethod === "CASH" && !cashEnabled) {
    fieldErrors.paymentMethod = "Cash payments are disabled.";
  }

  const nisFromForm = nullableText(formData, "nisNumber");
  const birFromForm = nullableText(formData, "birNumber");
  const notes = nullableText(formData, "notes");
  const pensionOnlyIncome = formData.get("pensionOnlyIncome") === "on";
  const exemptFromNis = formData.get("exemptFromNis") === "on";
  const receivingNisRetirementBenefit =
    formData.get("receivingNisRetirementBenefit") === "on";
  const exemptFromHealthSurcharge =
    formData.get("exemptFromHealthSurcharge") === "on";
  const exemptFromPaye = formData.get("exemptFromPaye") === "on";

  const nisCategoryOverrideRaw = nullableText(formData, "nisCategoryOverride");
  const nisCategoryOverride = NIS_CATEGORY_OVERRIDES.includes(
    nisCategoryOverrideRaw as NisCategoryOverride,
  )
    ? (nisCategoryOverrideRaw as NisCategoryOverride)
    : null;
  const nisOverrideReason = nullableText(formData, "nisOverrideReason");
  const nisOverrideEffectiveFromRaw = nullableText(
    formData,
    "nisOverrideEffectiveFrom",
  );
  const nisOverrideEffectiveToRaw = nullableText(
    formData,
    "nisOverrideEffectiveTo",
  );
  const nisOverrideEffectiveFrom = parseOptionalDate(
    nisOverrideEffectiveFromRaw,
  );
  const nisOverrideEffectiveTo = parseOptionalDate(nisOverrideEffectiveToRaw);

  const td1Raw = textValue(formData, "td1OtherApprovedAnnual");
  let td1OtherApprovedAnnual: number | null = null;

  if (td1Raw) {
    const parsed = Number(td1Raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      fieldErrors.td1OtherApprovedAnnual =
        "Enter a valid annual approved deduction amount.";
    } else {
      td1OtherApprovedAnnual = parsed;
    }
  }

  const bankAccountsRaw = textValue(formData, "bankAccountsJson");
  const bankAccounts = parseBankAccounts(bankAccountsRaw || "[]");

  if (!bankAccounts) {
    fieldErrors.bankAccounts = "Bank account information is invalid.";
  } else if (paymentMethod === "BANK_TRANSFER") {
    const bankError = validateBankAccounts(bankAccounts);
    if (bankError) {
      fieldErrors.bankAccounts = bankError;
    }
  }

  const allowanceTaxable = parseAllowanceTaxable(
    textValue(formData, "allowanceTaxableJson"),
  );

  if (!allowanceTaxable) {
    fieldErrors.allowanceTaxable = "Allowance taxable flags are invalid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the payroll setup information.",
      fieldErrors,
    };
  }

  const accountsForWrite = bankAccounts ?? [];
  const writesBankSetup =
    paymentMethod === "BANK_TRANSFER" && accountsForWrite.length > 0;

  if (writesBankSetup) {
    const canWriteBanks = actor.actor.canAny(
      "payroll.manage",
      "payroll.bank_accounts.create",
      "payroll.bank_accounts.update",
    );
    const canWriteAllocations = actor.actor.canAny(
      "payroll.manage",
      "payroll.allocations.manage",
    );
    if (!canWriteBanks || !canWriteAllocations) {
      return {
        status: "error",
        message:
          "You need payroll bank account and allocation permissions to save bank destinations.",
      };
    }
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      organizationId: true,
      nisNumber: true,
      birNumber: true,
      contracts: {
        where: {
          isCurrent: true,
          status: "ACTIVE",
        },
        take: 1,
        select: {
          id: true,
          baseSalary: true,
          allowances: {
            select: {
              id: true,
              isTaxable: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return {
      status: "error",
      message: "Employee not found.",
    };
  }

  const statutory = resolveEmployeeStatutoryWriteFromPayroll({
    actor: actor.actor,
    employee: {
      nisNumber: employee.nisNumber,
      birNumber: employee.birNumber,
    },
    form: {
      nisNumber: nisFromForm,
      birNumber: birFromForm,
    },
  });
  const nisNumber = statutory.resolved.nisNumber;
  const birNumber = statutory.resolved.birNumber;

  const contract = employee.contracts[0] ?? null;
  const accounts = bankAccounts ?? [];
  const requestedAllowanceTaxable = allowanceTaxable ?? {};

  const allowanceTaxableUpdates: Array<{
    id: string;
    label: string;
    previousIsTaxable: boolean;
    isTaxable: boolean;
  }> = [];

  if (contract) {
    const allowanceById = new Map(
      contract.allowances.map((allowance) => [allowance.id, allowance]),
    );

    for (const [allowanceId, isTaxable] of Object.entries(
      requestedAllowanceTaxable,
    )) {
      const allowance = allowanceById.get(allowanceId);
      if (!allowance) {
        continue;
      }
      if (allowance.isTaxable === isTaxable) {
        continue;
      }
      allowanceTaxableUpdates.push({
        id: allowance.id,
        label: allowance.category.name,
        previousIsTaxable: allowance.isTaxable,
        isTaxable,
      });
    }
  }

  const readiness = evaluatePayrollReadiness({
    hasCurrentContract: contract != null,
    baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
    nisNumber,
    birNumber,
    paymentMethod: paymentMethod!,
    bankAccounts: accounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountName,
      accountType: account.accountType,
      amount: account.amount,
      isPrimary: account.isPrimary,
    })),
    exemptFromNis,
    exemptFromPaye,
  });

  const metadata = await getAuditRequestMetadata(formData);

  const profileValues = {
    payFrequency: payFrequency!,
    paymentMethod: paymentMethod!,
    notes,
    pensionOnlyIncome,
    exemptFromNis,
    receivingNisRetirementBenefit,
    exemptFromHealthSurcharge,
    exemptFromPaye,
    nisCategoryOverride,
    nisOverrideReason,
    nisOverrideEffectiveFrom,
    nisOverrideEffectiveTo,
    isPayrollReady: readiness.isReady,
  };

  try {
    await prisma.$transaction(async (transaction) => {
      if (statutory.employeeUpdate) {
        await transaction.employee.update({
          where: {
            id: employee.id,
          },
          data: {
            nisNumber: statutory.employeeUpdate.nisNumber,
            birNumber: statutory.employeeUpdate.birNumber,
          },
        });
      }

      const profile = await transaction.payrollProfile.upsert({
        where: {
          employeeId: employee.id,
        },
        update: profileValues,
        create: {
          employeeId: employee.id,
          ...profileValues,
        },
        select: {
          id: true,
        },
      });

      let auditBanks: Array<Record<string, unknown>> = [];

      if (paymentMethod === "BANK_TRANSFER" && accounts.length > 0) {
        // Resolve catalog-key institution ids (from UI) to DB ids when needed.
        const resolvedAccounts = await Promise.all(
          accounts.map(async (account) => {
            if (!account.financialInstitutionId) {
              return account;
            }

            const byId = await transaction.financialInstitution.findUnique({
              where: { id: account.financialInstitutionId },
              select: {
                id: true,
                displayName: true,
                routingCode: true,
                achParticipantCode: true,
              },
            });
            if (byId) {
              return {
                ...account,
                financialInstitutionId: byId.id,
                bankName: account.bankName || byId.displayName,
                routingNumber:
                  account.routingNumber ||
                  byId.routingCode ||
                  byId.achParticipantCode ||
                  null,
              };
            }

            const byCatalog =
              await transaction.financialInstitution.findUnique({
                where: { catalogKey: account.financialInstitutionId },
                select: {
                  id: true,
                  displayName: true,
                  routingCode: true,
                  achParticipantCode: true,
                },
              });
            if (byCatalog) {
              return {
                ...account,
                financialInstitutionId: byCatalog.id,
                bankName: account.bankName || byCatalog.displayName,
                routingNumber:
                  account.routingNumber ||
                  byCatalog.routingCode ||
                  byCatalog.achParticipantCode ||
                  null,
              };
            }

            return { ...account, financialInstitutionId: null };
          }),
        );

        const bankWrite = await replaceEmployeeBankSetup(transaction, {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          payrollProfileId: profile.id,
          createdByUserId: actor.actor.userId,
          accounts: resolvedAccounts,
          flags: {
            splitDepositEnabled,
            fixedAmountEnabled,
            percentageEnabled,
            remainderEnabled,
            multipleAccountsEnabled,
          },
        });

        if (bankWrite.error) {
          throw new Error(bankWrite.error);
        }
        auditBanks = bankWrite.auditBanks ?? [];
      } else {
        const existingBankCount = await transaction.employeeBankAccount.count({
          where: { employeeId: employee.id, isActive: true },
        });
        if (existingBankCount > 0) {
          const canClearBanks = actor.actor.canAny(
            "payroll.manage",
            "payroll.bank_accounts.update",
            "payroll.bank_accounts.disable",
            "payroll.allocations.manage",
          );
          if (!canClearBanks) {
            throw new Error(
              "You need payroll bank account permissions to clear bank destinations.",
            );
          }
          const { deactivateEmployeeBankSetup } = await import(
            "@/src/modules/payroll/services/replace-employee-bank-setup"
          );
          await deactivateEmployeeBankSetup(transaction, {
            employeeId: employee.id,
            changeReason:
              paymentMethod === "BANK_TRANSFER"
                ? "Cleared payment instructions"
                : `Payment method changed to ${paymentMethod}`,
          });
        }
      }

      for (const update of allowanceTaxableUpdates) {
        await transaction.employmentContractAllowance.update({
          where: {
            id: update.id,
          },
          data: {
            isTaxable: update.isTaxable,
          },
        });
      }

      // Persist current-year TD1 on EmployeeTaxProfile (sole store).
      await upsertEmployeeTaxProfileTd1Sync(transaction, {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        taxYear: taxYearFromAsOfKey(toStatutoryAsOfKey(new Date())),
        td1OtherApprovedAnnual,
        userId: actor.actor.userId,
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "PayrollProfile",
        entityId: profile.id,
        description: `Updated payroll setup for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,
        newValues: {
          ...profileValues,
          employeeStatutoryUpdated: statutory.employeeUpdate != null,
          bankAccounts: auditBanks as Prisma.InputJsonValue,
          ...(allowanceTaxableUpdates.length > 0
            ? {
                allowanceTaxable: allowanceTaxableUpdates.map((update) => ({
                  id: update.id,
                  label: update.label,
                  previousIsTaxable: update.previousIsTaxable,
                  isTaxable: update.isTaxable,
                })),
              }
            : {}),
        },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to save payroll profile:", error);

    const message =
      error instanceof Error &&
      (error.message.includes("allocation") ||
        error.message.includes("Split deposits") ||
        error.message.includes("FULL_BALANCE") ||
        error.message.includes("Multiple employee") ||
        error.message.includes("Percentage") ||
        error.message.includes("Fixed-amount") ||
        error.message.includes("Remainder"))
        ? error.message
        : "Unable to save the payroll setup. Try again.";

    return {
      status: "error",
      message,
      fieldErrors:
        message !== "Unable to save the payroll setup. Try again."
          ? { bankAccounts: message }
          : undefined,
    };
  }

  revalidatePath("/payroll");
  revalidatePath(`/payroll/employees/${employee.id}`);
  revalidatePath(`/people/employees/${employee.id}`);
  redirect(`/payroll/employees/${employee.id}`);
}
