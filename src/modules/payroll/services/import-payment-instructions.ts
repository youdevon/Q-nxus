import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import {
  previewPaymentInstructionImport,
  rowsFromDelimitedMatrix,
  type PaymentInstructionImportMode,
  type PaymentInstructionImportPreview,
} from "@/src/modules/payroll/lib/payment-instruction-import";
import { accountNumberLastFour } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import { replaceEmployeeBankSetup } from "@/src/modules/payroll/services/replace-employee-bank-setup";
import { getSetupBankingFlags } from "@/src/modules/payroll/data/get-payroll-banking-features";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

export type PaymentInstructionImportCommitSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function parseDelimited(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
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
      if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current);
    return cells;
  });
}

export function previewPaymentInstructionsFromCsv(input: {
  csvText: string;
  mode: PaymentInstructionImportMode;
  knownEmployeeNumbers: ReadonlySet<string>;
  existingActiveKeys: ReadonlySet<string>;
}):
  | { ok: true; preview: PaymentInstructionImportPreview }
  | { ok: false; error: string } {
  const matrix = parseDelimited(input.csvText);
  const mapped = rowsFromDelimitedMatrix(matrix);
  if (!mapped.headersOk) {
    return {
      ok: false,
      error: `Missing required columns: ${mapped.missing.join(", ")}`,
    };
  }
  const preview = previewPaymentInstructionImport({
    rows: mapped.rows,
    mode: input.mode,
    knownEmployeeNumbers: input.knownEmployeeNumbers,
    existingActiveKeys: input.existingActiveKeys,
  });
  return { ok: true, preview };
}

export async function loadPaymentInstructionImportContext(
  organizationId: string,
): Promise<{
  knownEmployeeNumbers: Set<string>;
  existingActiveKeys: Set<string>;
  employeesByNumber: Map<
    string,
    { id: string; employeeNumber: string }
  >;
}> {
  const employees = await prisma.employee.findMany({
    where: { organizationId },
    select: {
      id: true,
      employeeNumber: true,
      bankAccounts: {
        where: { isActive: true },
        select: { accountNumber: true, accountNumberLastFour: true },
      },
    },
  });

  const knownEmployeeNumbers = new Set(employees.map((row) => row.employeeNumber));
  const employeesByNumber = new Map(
    employees.map((row) => [row.employeeNumber, row]),
  );
  const existingActiveKeys = new Set<string>();

  for (const employee of employees) {
    for (const account of employee.bankAccounts) {
      let digits = "";
      try {
        digits = (decryptAccountNumber(account.accountNumber) ?? "").replace(
          /\D/g,
          "",
        );
      } catch {
        digits = account.accountNumberLastFour;
      }
      existingActiveKeys.add(`${employee.employeeNumber}|${digits}`);
    }
  }

  return { knownEmployeeNumbers, existingActiveKeys, employeesByNumber };
}

/**
 * Commit a dry-run-validated import. Never silently overwrites — UPDATE_EXPLICIT
 * soft-deactivates prior active instructions and creates new rows (history kept).
 */
export async function commitPaymentInstructionImport(input: {
  organizationId: string;
  actorUserId: string;
  mode: PaymentInstructionImportMode;
  preview: PaymentInstructionImportPreview;
  dryRun?: boolean;
  audit?: AuditRequestMetadata;
}): Promise<PaymentInstructionImportCommitSummary> {
  const summary: PaymentInstructionImportCommitSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (!input.preview.ok && input.mode === "CREATE_ONLY") {
    return {
      ...summary,
      failed: input.preview.summary.errorRows,
      errors: ["Import has blocking errors — fix before committing."],
    };
  }

  if (input.dryRun) {
    return {
      created: input.preview.summary.validRows,
      updated: 0,
      skipped: input.preview.summary.errorRows,
      failed: 0,
      errors: [],
    };
  }

  const context = await loadPaymentInstructionImportContext(input.organizationId);
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

  // Group valid rows by employee — each employee gets a replace of their import rows.
  const byEmployee = new Map<
    string,
    NonNullable<(typeof input.preview.parsed)[number]>[]
  >();
  for (const row of input.preview.parsed) {
    if (!row) {
      summary.failed += 1;
      continue;
    }
    const list = byEmployee.get(row.employeeNumber) ?? [];
    list.push(row);
    byEmployee.set(row.employeeNumber, list);
  }

  for (const [employeeNumber, rows] of byEmployee) {
    const employee = context.employeesByNumber.get(employeeNumber);
    if (!employee) {
      summary.failed += rows.length;
      summary.errors.push(`Employee ${employeeNumber} not found at commit.`);
      continue;
    }

    const hadActive = [...context.existingActiveKeys].some((key) =>
      key.startsWith(`${employeeNumber}|`),
    );
    if (hadActive && input.mode === "CREATE_ONLY") {
      summary.skipped += rows.length;
      summary.errors.push(
        `Skipped ${employeeNumber}: active instructions exist (CREATE_ONLY).`,
      );
      continue;
    }

    const institutions = await prisma.financialInstitution.findMany({
      where: { isActive: true, isSelectableForEmployees: true },
      select: { id: true, displayName: true, shortName: true, legalName: true },
    });

    const resolveFi = (name: string) => {
      const normalized = name.trim().toLowerCase();
      return (
        institutions.find(
          (fi) =>
            fi.displayName.toLowerCase() === normalized ||
            fi.shortName.toLowerCase() === normalized ||
            fi.legalName.toLowerCase() === normalized,
        ) ?? null
      );
    };

    try {
      await prisma.$transaction(async (tx) => {
        const result = await replaceEmployeeBankSetup(tx, {
          organizationId: input.organizationId,
          employeeId: employee.id,
          createdByUserId: input.actorUserId,
          changeReason: `Bulk import (${input.mode})`,
          dataSource: "IMPORT",
          flags: {
            splitDepositEnabled: flags.splitDepositEnabled,
            fixedAmountEnabled: flags.fixedAmountEnabled,
            percentageEnabled: flags.percentageEnabled,
            remainderEnabled: flags.remainderEnabled,
            multipleAccountsEnabled: flags.multipleAccountsEnabled,
          },
          accounts: rows.map((row, index) => {
            const fi = resolveFi(row.financialInstitution);
            const isPrimary =
              row.allocationMethod === "REMAINING" ||
              rows.length === 1 ||
              (rows.filter((r) => r.allocationMethod === "REMAINING").length === 0 &&
                index === 0);
            return {
              financialInstitutionId: fi?.id ?? null,
              bankName: fi?.displayName ?? row.financialInstitution,
              branchName: row.branchTransit,
              branchCode: row.branchTransit,
              routingNumber: row.routingNumber,
              accountNumber: row.accountNumber,
              accountName: row.accountHolderName,
              accountType: row.accountType,
              amount:
                row.allocationMethod === "FIXED" ? row.allocationValue : null,
              percentage:
                row.allocationMethod === "PERCENTAGE"
                  ? row.allocationValue
                  : null,
              isPrimary,
              effectiveFrom: row.effectiveFrom,
              effectiveTo: row.effectiveTo,
              dataSource: "IMPORT" as const,
              verificationStatus: row.verificationStatus,
              isVerified: row.verificationStatus === "VERIFIED",
              changeReason: `Bulk import row for ${employeeNumber}`,
            };
          }),
        });
        if (result.error) {
          throw new Error(result.error);
        }
      });

      if (hadActive) {
        summary.updated += rows.length;
      } else {
        summary.created += rows.length;
      }
    } catch (error) {
      summary.failed += rows.length;
      summary.errors.push(
        `Employee ${employeeNumber}: ${
          error instanceof Error ? error.message : "Import failed"
        }`,
      );
    }
  }

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: input.organizationId,
    moduleKey: "payroll",
    action: "IMPORT_PAYMENT_INSTRUCTIONS",
    entityType: "EmployeeBankAccount",
    entityId: input.organizationId,
    description: `Imported payment instructions (${input.mode}): created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`,
    newValues: {
      mode: input.mode,
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed,
      // Never include account numbers in audit payloads.
      sampleLastFours: input.preview.parsed
        .filter(Boolean)
        .slice(0, 5)
        .map((row) => accountNumberLastFour(row!.accountNumber)),
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return summary;
}
