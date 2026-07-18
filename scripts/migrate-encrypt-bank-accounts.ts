/**
 * Migrate legacy plaintext bank account numbers to AES-256-GCM ciphertext.
 *
 * Usage: npx tsx scripts/migrate-encrypt-bank-accounts.ts
 * Requires AUTH_SECRET or BANK_ACCOUNT_ENCRYPTION_KEY in env.
 */

import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  encryptAccountNumber,
  isEncryptedAccountNumber,
} from "../src/modules/payroll/lib/bank-account-crypto";

async function main() {
  let employeeUpdated = 0;
  let allocationUpdated = 0;

  const accounts = await prisma.employeeBankAccount.findMany({
    select: { id: true, accountNumber: true },
  });

  for (const account of accounts) {
    if (isEncryptedAccountNumber(account.accountNumber)) {
      continue;
    }
    const encrypted = encryptAccountNumber(account.accountNumber);
    if (!encrypted || encrypted === account.accountNumber) {
      continue;
    }
    await prisma.employeeBankAccount.update({
      where: { id: account.id },
      data: { accountNumber: encrypted },
    });
    employeeUpdated += 1;
  }

  const allocations = await prisma.payrollPaymentAllocation.findMany({
    where: { accountNumberEncrypted: { not: null } },
    select: { id: true, accountNumberEncrypted: true },
  });

  for (const row of allocations) {
    const stored = row.accountNumberEncrypted;
    if (!stored || isEncryptedAccountNumber(stored)) {
      continue;
    }
    const encrypted = encryptAccountNumber(stored);
    if (!encrypted || encrypted === stored) {
      continue;
    }
    await prisma.payrollPaymentAllocation.update({
      where: { id: row.id },
      data: { accountNumberEncrypted: encrypted },
    });
    allocationUpdated += 1;
  }

  console.log(
    `Encrypted ${employeeUpdated} employee bank account(s) and ${allocationUpdated} payment allocation snapshot(s).`,
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
