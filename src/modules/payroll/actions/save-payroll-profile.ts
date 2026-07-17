"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";

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

type PayFrequency = (typeof PAY_FREQUENCIES)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type BankAccountInput = {
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  amount: number | null;
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
    const isPrimary = record.isPrimary === true;

    let amount: number | null = null;

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

    accounts.push({
      bankName,
      branchName,
      accountNumber,
      accountName,
      amount: isPrimary ? null : amount,
      isPrimary,
    });
  }

  return accounts;
}

function validateBankAccounts(
  accounts: BankAccountInput[],
): string | undefined {
  if (accounts.length === 0) {
    return "Add at least one bank account for bank transfer.";
  }

  for (const account of accounts) {
    if (!account.bankName || !account.accountNumber) {
      return "Every bank account needs a bank name and account number.";
    }
  }

  const primaryCount = accounts.filter((account) => account.isPrimary).length;

  if (primaryCount !== 1) {
    return "Mark exactly one bank account as primary (receives the remainder of net pay).";
  }

  for (const account of accounts) {
    if (account.isPrimary) {
      continue;
    }

    if (account.amount == null || !(account.amount > 0)) {
      return "Each secondary bank account needs a fixed amount greater than zero.";
    }
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

  const nisNumber = nullableText(formData, "nisNumber");
  const birNumber = nullableText(formData, "birNumber");
  const notes = nullableText(formData, "notes");
  const pensionOnlyIncome = formData.get("pensionOnlyIncome") === "on";

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

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the payroll setup information.",
      fieldErrors,
    };
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
      contracts: {
        where: {
          isCurrent: true,
          status: "ACTIVE",
        },
        take: 1,
        select: {
          baseSalary: true,
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

  const contract = employee.contracts[0] ?? null;
  const accounts = bankAccounts ?? [];

  const readiness = evaluatePayrollReadiness({
    hasCurrentContract: contract != null,
    baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
    nisNumber,
    birNumber,
    paymentMethod: paymentMethod!,
    bankAccounts: accounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.amount,
      isPrimary: account.isPrimary,
    })),
  });

  const metadata = await getAuditRequestMetadata(formData);

  const profileValues = {
    payFrequency: payFrequency!,
    paymentMethod: paymentMethod!,
    nisNumber,
    birNumber,
    notes,
    td1OtherApprovedAnnual:
      td1OtherApprovedAnnual == null
        ? null
        : new Prisma.Decimal(td1OtherApprovedAnnual.toFixed(2)),
    pensionOnlyIncome,
    isPayrollReady: readiness.isReady,
  };

  try {
    await prisma.$transaction(async (transaction) => {
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

      await transaction.payrollBankAccount.deleteMany({
        where: {
          payrollProfileId: profile.id,
        },
      });

      if (accounts.length > 0) {
        // Exactly one primary: honour the flagged row, else the first.
        const primaryIndex = Math.max(
          accounts.findIndex((account) => account.isPrimary),
          0,
        );

        await transaction.payrollBankAccount.createMany({
          data: accounts.map((account, index) => {
            const isPrimary = index === primaryIndex;

            return {
              payrollProfileId: profile.id,
              bankName: account.bankName,
              branchName: account.branchName,
              accountNumber: account.accountNumber,
              accountName: account.accountName,
              amount:
                isPrimary || account.amount == null
                  ? null
                  : new Prisma.Decimal(account.amount.toFixed(2)),
              isPrimary,
              sortOrder: index,
            };
          }),
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "PayrollProfile",
          entityId: profile.id,
          description: `Updated payroll setup for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,
          newValues: {
            ...profileValues,
            bankAccounts: accounts.map((account) => ({
              bankName: account.bankName,
              accountNumber: account.accountNumber,
              amount: account.amount,
              isPrimary: account.isPrimary,
            })),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    console.error("Unable to save payroll profile:", error);

    return {
      status: "error",
      message: "Unable to save the payroll setup. Try again.",
    };
  }

  revalidatePath("/payroll");
  revalidatePath(`/people/employees/${employee.id}`);
  revalidatePath(`/people/employees/${employee.id}/payroll`);
  redirect(`/people/employees/${employee.id}/payroll`);
}
