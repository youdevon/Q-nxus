/**
 * Historical backfill: EmployeeBankAccount from legacy PayrollBankAccount.
 *
 * The `payroll.payroll_bank_accounts` table was dropped in migration
 * `20260720210000_retire_payroll_dual_stores`. This script is retained only
 * as a no-op so existing docs / npm scripts do not crash.
 *
 * Usage: npm run banking:backfill-accounts
 */

import "dotenv/config";

async function main() {
  console.log(
    JSON.stringify(
      {
        skipped: true,
        reason:
          "PayrollBankAccount table retired; EmployeeBankAccount is the sole store.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
