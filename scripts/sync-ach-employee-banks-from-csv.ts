/**
 * Sync employee bank payment instructions from a First Citizens ACH
 * status/result CSV (bank confirmation file), then verify ACH fields.
 *
 * Source columns (bank ACH status/result file; pipe- or comma-delimited):
 *   Account_Number | Transaction_Code | ABA_Number | Name | Id |
 *   Purpose_Code | Amount | Record_Status | Error_Code | Error_Message
 *
 * Notes:
 * - `Id` = Individual ID = HR employeeNumber
 * - Transaction_Code 22 = Checking Credit, 32 = Savings Credit
 * - Amount is the net ACH credit (after tax for that payroll) — verification
 *   only; never written as base salary / contract pay.
 * - Our FCB manual-entry export uses Payment Type labels + text Purpose Code;
 *   the bank status file uses numeric Transaction_Code / Purpose_Code.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/sync-ach-employee-banks-from-csv.ts \
 *     --csv="/Users/devon/Desktop/ACH_....csv"
 *   npx tsx --env-file=.env scripts/sync-ach-employee-banks-from-csv.ts \
 *     --csv="..." --apply
 *
 * Default is dry-run (report only). Pass --apply to write bank accounts.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import { seedFinancialInstitutions } from "../prisma/seed-financial-institutions";
import {
  decryptAccountNumber,
  maskAccountNumberForLog,
} from "@/src/modules/payroll/lib/bank-account-crypto";
import {
  firstCitizensPaymentType,
  resolveFirstCitizensAbaNumber,
  resolveFirstCitizensPaymentType,
} from "@/src/modules/payroll/lib/payment-instructions";
import { TT_FINANCIAL_INSTITUTIONS } from "@/src/modules/payroll/lib/tt-financial-institutions";
import { getSetupBankingFlags } from "@/src/modules/payroll/data/get-payroll-banking-features";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { replaceEmployeeBankSetup } from "@/src/modules/payroll/services/replace-employee-bank-setup";

const DEFAULT_CSV =
  "/Users/devon/Desktop/ACH_260728546671225_20260813_144905885.csv";

type AchCsvRow = {
  accountNumber: string;
  transactionCode: string;
  abaNumber: string;
  name: string;
  individualId: string;
  purposeCode: string;
  amount: number;
  recordStatus: string;
};

function parseArgs(argv: string[]) {
  let csvPath = DEFAULT_CSV;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg.startsWith("--csv=")) {
      csvPath = arg.slice("--csv=".length);
      continue;
    }
    if (arg === "--csv") {
      csvPath = argv[++i] ?? csvPath;
      continue;
    }
  }
  return { csvPath: resolve(csvPath), apply };
}

function detectDelimiter(headerLine: string): "," | "|" {
  const pipes = (headerLine.match(/\|/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return pipes > commas ? "|" : ",";
}

function parseDelimited(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]!);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  });
}

function parseAchStatusCsv(text: string): AchCsvRow[] {
  const matrix = parseDelimited(text);
  if (matrix.length < 2) {
    throw new Error("CSV has no data rows.");
  }
  const header = matrix[0]!.map((h) => h.toLowerCase());
  const idx = (name: string) => {
    const i = header.indexOf(name.toLowerCase());
    if (i < 0) {
      throw new Error(`Missing CSV column: ${name}`);
    }
    return i;
  };
  const col = {
    account: idx("Account_Number"),
    txn: idx("Transaction_Code"),
    aba: idx("ABA_Number"),
    name: idx("Name"),
    id: idx("Id"),
    purpose: idx("Purpose_Code"),
    amount: idx("Amount"),
    status: idx("Record_Status"),
  };

  return matrix.slice(1).map((row) => {
    const amount = Number(row[col.amount] ?? "");
    if (!Number.isFinite(amount)) {
      throw new Error(`Invalid amount on row for Id=${row[col.id]}`);
    }
    return {
      accountNumber: row[col.account] ?? "",
      transactionCode: row[col.txn] ?? "",
      abaNumber: row[col.aba] ?? "",
      name: row[col.name] ?? "",
      individualId: row[col.id] ?? "",
      purposeCode: row[col.purpose] ?? "",
      amount,
      recordStatus: row[col.status] ?? "",
    };
  });
}

function transactionCodeToAccountType(
  code: string,
): "SAVINGS" | "CHEQUING" | null {
  if (code === "32") return "SAVINGS";
  if (code === "22") return "CHEQUING";
  return null;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLooselyMatch(csvName: string, employeeName: string): boolean {
  const a = normalizeName(csvName);
  const b = normalizeName(employeeName);
  if (a === b) return true;
  // Allow hyphen / middle-name variance (Nedd Duke vs Nedd-Duke, Guy-Green vs Guy-Greene).
  const tokensA = new Set(a.split(" "));
  const tokensB = new Set(b.split(" "));
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared += 1;
    else {
      for (const u of tokensB) {
        if (t.startsWith(u) || u.startsWith(t)) {
          shared += 1;
          break;
        }
      }
    }
  }
  return shared >= Math.min(2, tokensA.size, tokensB.size);
}

function maskLast4(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length >= 4) return `••••${digits.slice(-4)}`;
  return "••••";
}

async function main() {
  const { csvPath, apply } = parseArgs(process.argv.slice(2));
  console.log(`CSV: ${csvPath}`);
  console.log(`Mode: ${apply ? "APPLY (will write)" : "DRY-RUN (report only)"}`);

  const rows = parseAchStatusCsv(readFileSync(csvPath, "utf8"));
  console.log(`Parsed ${rows.length} ACH row(s).\n`);

  // Ensure catalog ABA codes are on FinancialInstitution rows.
  await seedFinancialInstitutions(prisma);

  const institutions = await prisma.financialInstitution.findMany({
    where: { isActive: true, routingCode: { not: null } },
    select: {
      id: true,
      catalogKey: true,
      displayName: true,
      shortName: true,
      routingCode: true,
    },
  });
  const byAba = new Map(
    institutions
      .filter((i) => i.routingCode)
      .map((i) => [i.routingCode!, i]),
  );

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      bankAccounts: {
        where: { isActive: true, archivedAt: null },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          bankName: true,
          routingNumber: true,
          accountNumber: true,
          accountNumberLastFour: true,
          accountType: true,
          accountHolderName: true,
          isPrimary: true,
          financialInstitution: {
            select: {
              catalogKey: true,
              displayName: true,
              routingCode: true,
              shortName: true,
            },
          },
        },
      },
    },
  });
  const byNumber = new Map(employees.map((e) => [e.employeeNumber, e]));

  type MatchResult = {
    csv: AchCsvRow;
    status: "matched" | "unmatched" | "ambiguous";
    employee?: (typeof employees)[number];
    nameOk?: boolean;
    institution?: (typeof institutions)[number];
    accountType?: "SAVINGS" | "CHEQUING";
    before?: {
      bank: string;
      aba: string;
      last4: string;
      type: string;
      holder: string | null;
      fi: string | null;
    } | null;
    fieldDiffs: string[];
    wouldUpdate: boolean;
  };

  const results: MatchResult[] = [];

  for (const csv of rows) {
    const employee = byNumber.get(csv.individualId);
    const accountType = transactionCodeToAccountType(csv.transactionCode);
    const institution = byAba.get(csv.abaNumber);

    if (!employee) {
      results.push({
        csv,
        status: "unmatched",
        accountType: accountType ?? undefined,
        institution,
        fieldDiffs: [`No employee with employeeNumber=${csv.individualId}`],
        wouldUpdate: false,
      });
      continue;
    }

    const employeeName = [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(" ");
    const nameOk = namesLooselyMatch(csv.name, employeeName);
    if (!nameOk) {
      results.push({
        csv,
        status: "ambiguous",
        employee,
        nameOk: false,
        accountType: accountType ?? undefined,
        institution,
        fieldDiffs: [
          `Name mismatch: CSV "${csv.name}" vs HR "${employeeName}" (Id ${csv.individualId})`,
        ],
        wouldUpdate: false,
      });
      continue;
    }

    if (!accountType) {
      results.push({
        csv,
        status: "matched",
        employee,
        nameOk: true,
        institution,
        fieldDiffs: [
          `Unknown Transaction_Code=${csv.transactionCode} (expected 22 or 32)`,
        ],
        wouldUpdate: false,
      });
      continue;
    }

    if (!institution) {
      const catalogHint = TT_FINANCIAL_INSTITUTIONS.find(
        (t) => t.routingCode === csv.abaNumber,
      );
      results.push({
        csv,
        status: "matched",
        employee,
        nameOk: true,
        accountType,
        fieldDiffs: [
          `No FinancialInstitution for ABA ${csv.abaNumber}` +
            (catalogHint ? ` (catalog has ${catalogHint.id})` : ""),
        ],
        wouldUpdate: false,
      });
      continue;
    }

    const primary = employee.bankAccounts[0] ?? null;
    let currentPlain: string | null = null;
    if (primary) {
      try {
        currentPlain = decryptAccountNumber(primary.accountNumber);
      } catch {
        currentPlain = null;
      }
    }

    const before = primary
      ? {
          bank: primary.bankName,
          aba:
            primary.routingNumber ??
            primary.financialInstitution?.routingCode ??
            "",
          last4: primary.accountNumberLastFour,
          type: primary.accountType,
          holder: primary.accountHolderName,
          fi: primary.financialInstitution?.catalogKey ?? null,
        }
      : null;

    const fieldDiffs: string[] = [];
    if (!primary) {
      fieldDiffs.push("no active bank account (will create)");
    } else {
      const currentAba = resolveFirstCitizensAbaNumber({
        routingNumber: primary.routingNumber,
        routingCode: primary.financialInstitution?.routingCode,
        bankName: primary.bankName,
      });
      if (currentAba !== csv.abaNumber) {
        fieldDiffs.push(`ABA ${currentAba || "(empty)"} → ${csv.abaNumber}`);
      }
      if ((currentPlain ?? "") !== csv.accountNumber) {
        fieldDiffs.push(
          `account ${maskAccountNumberForLog(currentPlain)} → ${maskLast4(csv.accountNumber)}`,
        );
      }
      if (primary.accountType !== accountType) {
        fieldDiffs.push(`type ${primary.accountType} → ${accountType}`);
      }
      if (primary.financialInstitution?.catalogKey !== institution.catalogKey) {
        fieldDiffs.push(
          `institution ${primary.financialInstitution?.catalogKey ?? "(none)"} → ${institution.catalogKey}`,
        );
      }
    }

    // What our FCB export would emit after update vs bank status row.
    const exportPaymentType = firstCitizensPaymentType(accountType);
    const bankPaymentType =
      csv.transactionCode === "22"
        ? "Checking Credit"
        : csv.transactionCode === "32"
          ? "Savings Credit"
          : `txn:${csv.transactionCode}`;
    if (exportPaymentType !== bankPaymentType) {
      fieldDiffs.push(
        `payment-type mapping gap: export "${exportPaymentType}" vs bank txn ${csv.transactionCode} (${bankPaymentType})`,
      );
    }

    results.push({
      csv,
      status: "matched",
      employee,
      nameOk: true,
      institution,
      accountType,
      before,
      fieldDiffs,
      wouldUpdate: fieldDiffs.some(
        (d) =>
          d.startsWith("ABA ") ||
          d.startsWith("account ") ||
          d.startsWith("type ") ||
          d.startsWith("institution ") ||
          d.includes("will create"),
      ),
    });
  }

  // Optional: compare net amounts to any July pay-run nets if present.
  const julyRuns = await prisma.payRun.findMany({
    where: {
      OR: [
        { payrollPeriod: { name: { contains: "July", mode: "insensitive" } } },
        { payrollPeriod: { periodKey: { contains: "2026-07" } } },
        {
          payrollPeriod: {
            periodEnd: {
              gte: new Date("2026-07-01T00:00:00.000Z"),
              lte: new Date("2026-07-31T23:59:59.999Z"),
            },
          },
        },
      ],
    },
    select: {
      id: true,
      runNumber: true,
      status: true,
      payrollPeriod: { select: { name: true, periodKey: true } },
      payslips: {
        select: {
          employeeNumber: true,
          netPay: true,
        },
      },
    },
  });

  console.log("=== Match report ===\n");
  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let toUpdate = 0;

  for (const r of results) {
    if (r.status === "unmatched") unmatched += 1;
    else if (r.status === "ambiguous") ambiguous += 1;
    else matched += 1;
    if (r.wouldUpdate) toUpdate += 1;

    const empLabel = r.employee
      ? `#${r.employee.employeeNumber} ${[r.employee.firstName, r.employee.lastName].join(" ")}`
      : "(no HR match)";
    console.log(
      `[${r.status.toUpperCase()}] CSV Id=${r.csv.individualId} "${r.csv.name}" → ${empLabel}`,
    );
    console.log(
      `  bank ABA ${r.csv.abaNumber} (${r.institution?.shortName ?? "unknown FI"}) ` +
        `acct ${maskLast4(r.csv.accountNumber)} type=${r.accountType ?? "?"} ` +
        `netACH=${r.csv.amount.toFixed(2)} status=${r.csv.recordStatus}`,
    );
    if (r.before) {
      console.log(
        `  before: fi=${r.before.fi ?? "?"} ABA=${r.before.aba || "(empty)"} ` +
          `••••${r.before.last4} type=${r.before.type}`,
      );
    } else if (r.status === "matched") {
      console.log("  before: (no active account)");
    }
    if (r.fieldDiffs.length) {
      for (const d of r.fieldDiffs) console.log(`  · ${d}`);
    } else {
      console.log("  · ACH bank fields already match");
    }

    // Purpose code note (format difference, not employee data).
    if (r.csv.purposeCode && r.csv.purposeCode !== "COMPENSATION OF EMPLOYEES") {
      console.log(
        `  · purpose: bank status file uses code "${r.csv.purposeCode}" ` +
          `(our export uses text "COMPENSATION OF EMPLOYEES" / profile default)`,
      );
    }
    console.log("");
  }

  if (julyRuns.length === 0) {
    console.log(
      "July pay-run amount check: no July 2026 pay run in DB — " +
        "CSV Amount treated as net ACH credit for verification only (not applied as salary).\n",
    );
  } else {
    console.log("July pay-run net vs CSV ACH amount:");
    for (const run of julyRuns) {
      console.log(
        `  run ${run.runNumber} (${run.payrollPeriod.name} / ${run.payrollPeriod.periodKey}) status=${run.status}`,
      );
      const netByEmp = new Map(
        run.payslips.map((l) => [l.employeeNumber, Number(l.netPay)]),
      );
      for (const r of results) {
        if (r.status !== "matched") continue;
        const sysNet = netByEmp.get(r.csv.individualId);
        if (sysNet == null) {
          console.log(
            `    #${r.csv.individualId}: no payslip in run (CSV netACH ${r.csv.amount.toFixed(2)})`,
          );
          continue;
        }
        const ok = Math.abs(sysNet - r.csv.amount) < 0.005;
        console.log(
          `    #${r.csv.individualId}: CSV netACH ${r.csv.amount.toFixed(2)} vs run net ${sysNet.toFixed(2)} ${ok ? "MATCH" : "MISMATCH"}`,
        );
      }
    }
    console.log("");
  }

  console.log("=== Summary ===");
  console.log(`CSV rows:     ${rows.length}`);
  console.log(`Matched:      ${matched}`);
  console.log(`Unmatched:    ${unmatched}`);
  console.log(`Ambiguous:    ${ambiguous}`);
  console.log(`Would update: ${toUpdate}`);

  // Post-update ACH field comparison shape (what we generate).
  console.log("\n=== ACH field mapping (bank status CSV ↔ our FCB export) ===");
  console.log(
    "Account_Number ↔ Account Number | ABA_Number ↔ ABA Number | Id ↔ Individual ID | Name ↔ Individual Name",
  );
  console.log(
    "Transaction_Code 32/22 ↔ Payment Type Savings Credit / Checking Credit",
  );
  console.log(
    'Purpose_Code "15" (bank) ↔ Purpose Code "COMPENSATION OF EMPLOYEES" (our worksheet default)',
  );
  console.log(
    "Amount ↔ Amount (net ACH credit; not base salary)",
  );

  if (!apply) {
    console.log(
      "\nDry-run complete. Re-run with --apply to update EmployeeBankAccount rows.",
    );
    return;
  }

  const setupFlags = await getSetupBankingFlags();
  const [fixedAmountEnabled, remainderEnabled] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.FIXED_AMOUNT_ALLOCATION_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.REMAINDER_ALLOCATION_ENABLED,
    ),
  ]);
  const flags = {
    splitDepositEnabled: setupFlags.splitDepositEnabled,
    fixedAmountEnabled,
    percentageEnabled: setupFlags.percentageAllocationEnabled,
    remainderEnabled,
    multipleAccountsEnabled: setupFlags.multipleAccountsEnabled,
  };

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of results) {
    if (!r.wouldUpdate || !r.employee || !r.institution || !r.accountType) {
      skipped += 1;
      continue;
    }

    const holder =
      r.employee.bankAccounts[0]?.accountHolderName?.trim() ||
      r.csv.name.trim();

    try {
      await prisma.$transaction(async (tx) => {
        const result = await replaceEmployeeBankSetup(tx, {
          organizationId: r.employee!.organizationId,
          employeeId: r.employee!.id,
          createdByUserId: null,
          changeReason:
            "Synced from FCB ACH status CSV (bank confirmation) — payment destination only",
          dataSource: "IMPORT",
          flags,
          accounts: [
            {
              financialInstitutionId: r.institution!.id,
              bankName: r.institution!.displayName,
              branchName: null,
              routingNumber: r.csv.abaNumber,
              accountNumber: r.csv.accountNumber,
              accountName: holder,
              accountType: r.accountType!,
              amount: null,
              percentage: null,
              isPrimary: true,
              dataSource: "IMPORT",
              changeReason:
                "Synced from FCB ACH status CSV (bank confirmation)",
              verificationStatus: "VERIFIED",
              isVerified: true,
            },
          ],
        });
        if (result.error) {
          throw new Error(result.error);
        }
      });
      updated += 1;
      console.log(
        `Updated #${r.employee.employeeNumber} → ${r.institution.shortName} ${maskLast4(r.csv.accountNumber)} ${r.accountType}`,
      );
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED #${r.employee.employeeNumber}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Verify post-apply: regenerate effective ACH fields from stored accounts.
  console.log("\n=== Post-apply ACH field verification ===");
  const refreshed = await prisma.employee.findMany({
    where: {
      employeeNumber: { in: results.filter((r) => r.wouldUpdate).map((r) => r.csv.individualId) },
    },
    select: {
      employeeNumber: true,
      firstName: true,
      lastName: true,
      bankAccounts: {
        where: { isActive: true, archivedAt: null },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: {
          bankName: true,
          routingNumber: true,
          accountNumber: true,
          accountType: true,
          accountHolderName: true,
          financialInstitution: {
            select: { routingCode: true, displayName: true, shortName: true },
          },
        },
      },
    },
  });
  const refreshedByNumber = new Map(
    refreshed.map((e) => [e.employeeNumber, e]),
  );

  let fieldMatches = 0;
  let fieldGaps = 0;
  for (const r of results) {
    if (!r.wouldUpdate) continue;
    const emp = refreshedByNumber.get(r.csv.individualId);
    const acct = emp?.bankAccounts[0];
    if (!acct) {
      console.log(`#${r.csv.individualId}: missing account after apply`);
      fieldGaps += 1;
      continue;
    }
    let plain = "";
    try {
      plain = decryptAccountNumber(acct.accountNumber) ?? "";
    } catch {
      plain = "";
    }
    const aba = resolveFirstCitizensAbaNumber({
      routingNumber: acct.routingNumber,
      routingCode: acct.financialInstitution?.routingCode,
      bankName: acct.bankName,
    });
    const paymentType = resolveFirstCitizensPaymentType({
      accountType: acct.accountType,
    });
    const expectedType =
      r.csv.transactionCode === "22" ? "Checking Credit" : "Savings Credit";
    const gaps: string[] = [];
    if (aba !== r.csv.abaNumber) gaps.push(`ABA ${aba}≠${r.csv.abaNumber}`);
    if (plain !== r.csv.accountNumber) {
      gaps.push(`acct ${maskLast4(plain)}≠${maskLast4(r.csv.accountNumber)}`);
    }
    if (paymentType !== expectedType) {
      gaps.push(`type ${paymentType}≠${expectedType}`);
    }
    if (gaps.length) {
      fieldGaps += 1;
      console.log(`#${r.csv.individualId}: GAPS ${gaps.join("; ")}`);
    } else {
      fieldMatches += 1;
      console.log(
        `#${r.csv.individualId}: MATCH ABA=${aba} ${maskLast4(plain)} ${paymentType}`,
      );
    }
  }

  console.log(
    `\nApply complete: updated=${updated} skipped=${skipped} failed=${failed} ` +
      `postVerify match=${fieldMatches} gaps=${fieldGaps}`,
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
