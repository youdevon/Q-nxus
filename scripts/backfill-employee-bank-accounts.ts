/**
 * Backfill EmployeeBankAccount (+ allocations) from legacy PayrollBankAccount.
 *
 * For each payroll profile that still has PayrollBankAccount rows whose employee
 * has no EmployeeBankAccount yet, create the Phase 1 destination model.
 *
 * Usage: npx tsx scripts/backfill-employee-bank-accounts.ts
 *        npm run banking:backfill-accounts
 *
 * Idempotent: employees that already have EmployeeBankAccount rows are skipped.
 */

import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  accountNumberLastFour,
} from "../src/modules/payroll/lib/employee-bank-account-adapter";
import {
  decryptAccountNumber,
  encryptAccountNumber,
} from "../src/modules/payroll/lib/bank-account-crypto";
import { findTtFinancialInstitutionByName } from "../src/modules/payroll/lib/tt-financial-institutions";

type LegacyAccount = {
  id: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  amount: { toString(): string } | null;
  isPrimary: boolean;
  sortOrder: number;
};

function plaintextAccount(stored: string): string {
  try {
    return decryptAccountNumber(stored) ?? stored;
  } catch {
    return stored;
  }
}

async function resolveFinancialInstitutionId(
  bankName: string,
  institutionByCatalogKey: Map<string, string>,
  institutionByName: Map<string, string>,
): Promise<string | null> {
  const trimmed = bankName.trim();
  if (!trimmed) {
    return null;
  }

  const key = trimmed.toLowerCase();
  const byExactName = institutionByName.get(key);
  if (byExactName) {
    return byExactName;
  }

  const catalog = findTtFinancialInstitutionByName(trimmed);
  if (catalog) {
    return institutionByCatalogKey.get(catalog.id) ?? null;
  }

  return null;
}

async function main() {
  const institutions = await prisma.financialInstitution.findMany({
    select: {
      id: true,
      catalogKey: true,
      displayName: true,
      shortName: true,
    },
  });

  const institutionByCatalogKey = new Map<string, string>();
  const institutionByName = new Map<string, string>();
  for (const row of institutions) {
    if (row.catalogKey) {
      institutionByCatalogKey.set(row.catalogKey, row.id);
    }
    institutionByName.set(row.displayName.toLowerCase(), row.id);
    institutionByName.set(row.shortName.toLowerCase(), row.id);
  }

  const profiles = await prisma.payrollProfile.findMany({
    where: {
      bankAccounts: { some: {} },
    },
    select: {
      id: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          organizationId: true,
          employeeNumber: true,
          bankAccounts: { select: { id: true }, take: 1 },
        },
      },
      bankAccounts: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          bankName: true,
          branchName: true,
          accountNumber: true,
          accountName: true,
          amount: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
    },
  });

  let skippedAlreadyBackfilled = 0;
  let skippedEmpty = 0;
  let employeesBackfilled = 0;
  let accountsCreated = 0;
  let allocationsCreated = 0;
  let institutionsMatched = 0;

  for (const profile of profiles) {
    if (profile.employee.bankAccounts.length > 0) {
      skippedAlreadyBackfilled += 1;
      continue;
    }

    const legacy = profile.bankAccounts as LegacyAccount[];
    if (legacy.length === 0) {
      skippedEmpty += 1;
      continue;
    }

    const primaryIndex = Math.max(
      legacy.findIndex((account) => account.isPrimary),
      0,
    );

    await prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];

      for (const [index, account] of legacy.entries()) {
        const isPrimary = index === primaryIndex;
        const plaintext = plaintextAccount(account.accountNumber);
        const encrypted =
          encryptAccountNumber(plaintext) ?? plaintext;
        const financialInstitutionId = await resolveFinancialInstitutionId(
          account.bankName,
          institutionByCatalogKey,
          institutionByName,
        );
        if (financialInstitutionId) {
          institutionsMatched += 1;
        }

        const created = await tx.employeeBankAccount.create({
          data: {
            organizationId: profile.employee.organizationId,
            employeeId: profile.employeeId,
            financialInstitutionId,
            bankName: account.bankName,
            branchName: account.branchName,
            accountHolderName: account.accountName,
            accountNumber: encrypted,
            accountNumberLastFour: accountNumberLastFour(plaintext),
            isPrimary,
            isPayrollEnabled: true,
            sortOrder: account.sortOrder ?? index,
            verificationStatus: "NOT_REQUIRED",
            isVerified: false,
          },
          select: { id: true },
        });
        createdIds.push(created.id);
        accountsCreated += 1;

        const amount =
          account.amount != null ? Number(account.amount.toString()) : null;
        const allocationType =
          legacy.length === 1
            ? "FULL_BALANCE"
            : isPrimary
              ? "REMAINDER"
              : "FIXED_AMOUNT";

        await tx.employeePayrollAllocation.create({
          data: {
            organizationId: profile.employee.organizationId,
            employeeId: profile.employeeId,
            employeeBankAccountId: created.id,
            allocationType,
            fixedAmount:
              allocationType === "FIXED_AMOUNT" &&
              amount != null &&
              Number.isFinite(amount)
                ? amount.toFixed(2)
                : null,
            percentage: null,
            receivesRemainder:
              allocationType === "REMAINDER" ||
              allocationType === "FULL_BALANCE",
            priority: index,
            isActive: true,
          },
        });
        allocationsCreated += 1;
      }
    });

    employeesBackfilled += 1;
    console.log(
      `Backfilled ${profile.employee.employeeNumber}: ${legacy.length} account(s).`,
    );
  }

  console.log(
    JSON.stringify(
      {
        profilesScanned: profiles.length,
        employeesBackfilled,
        accountsCreated,
        allocationsCreated,
        institutionsMatched,
        skippedAlreadyBackfilled,
        skippedEmpty,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
