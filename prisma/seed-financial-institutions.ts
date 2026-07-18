import { createHash } from "node:crypto";

import type { FinancialInstitutionType, PrismaClient } from "../generated/prisma/client";
import {
  TT_FINANCIAL_INSTITUTIONS,
  type TtFinancialInstitutionCategoryId,
} from "../src/modules/payroll/lib/tt-financial-institutions";
import { accountNumberLastFour } from "../src/modules/payroll/lib/employee-bank-account-adapter";
import { PAYROLL_BANKING_FEATURE_DEFAULTS } from "../src/modules/payroll/lib/payroll-banking-flags";
import { ConfigurationStatus } from "../generated/prisma/client";

const COMMERCIAL_BANK_CATALOG_KEYS = new Set([
  "ansa-bank",
  "cibc",
  "citi",
  "fcb",
  "jmmb-bank",
  "rbc",
  "rbl",
  "scotia",
]);

function mapCategoryToType(
  category: TtFinancialInstitutionCategoryId,
): FinancialInstitutionType {
  switch (category) {
    case "COMMERCIAL_BANKS":
      return "COMMERCIAL_BANK";
    case "LICENSED_NON_BANK":
      return "LICENSED_NON_BANK";
    case "INVESTMENT_MORTGAGE_DEVELOPMENT":
      return "INVESTMENT_MORTGAGE_DEVELOPMENT";
    case "CREDIT_UNIONS":
      return "CREDIT_UNION";
    case "CREDIT_UNION_SUPPORT":
      return "CREDIT_UNION_SUPPORT";
    case "PAYMENT_PROVIDERS":
      return "ELECTRONIC_MONEY";
    default:
      return "OTHER";
  }
}

function stableInstitutionId(catalogKey: string): string {
  const digest = createHash("sha256")
    .update(`fi:${catalogKey}`)
    .digest("hex")
    .slice(0, 24);
  return `fi_${digest}`;
}

/**
 * Seed TT financial institutions from the curated catalog.
 *
 * Commercial banks (8): selectable, payroll deposits on.
 * ACH routing / participant codes left NULL — REQUIRES_CONFIRMATION.
 * Other catalog entries: selectable for employees, supportsAchCredits=false.
 */
export async function seedFinancialInstitutions(
  prisma: PrismaClient,
): Promise<void> {
  for (const entry of TT_FINANCIAL_INSTITUTIONS) {
    const isCommercial = COMMERCIAL_BANK_CATALOG_KEYS.has(entry.id);
    const id = stableInstitutionId(entry.id);

    await prisma.financialInstitution.upsert({
      where: { catalogKey: entry.id },
      update: {
        legalName: entry.name,
        displayName: entry.name,
        shortName: entry.shortName,
        institutionType: mapCategoryToType(entry.category),
        countryCode: "TT",
        currencyCode: "TTD",
        // Do not invent ACH codes — leave null (REQUIRES_CONFIRMATION).
        achParticipantCode: null,
        routingCode: null,
        supportsAchCredits: false,
        supportsAchDebits: false,
        supportsPayrollDeposits: isCommercial || entry.category === "CREDIT_UNIONS",
        isSelectableForEmployees: true,
        isActive: true,
        archivedAt: null,
      },
      create: {
        id,
        catalogKey: entry.id,
        legalName: entry.name,
        displayName: entry.name,
        shortName: entry.shortName,
        institutionType: mapCategoryToType(entry.category),
        countryCode: "TT",
        currencyCode: "TTD",
        // REQUIRES_CONFIRMATION — do not invent official ACH routing codes.
        achParticipantCode: null,
        routingCode: null,
        supportsAchCredits: false,
        supportsAchDebits: false,
        supportsPayrollDeposits: isCommercial || entry.category === "CREDIT_UNIONS",
        supportsSplitDeposits: true,
        isSelectableForEmployees: true,
        isActive: true,
      },
    });
  }
}

export async function seedPayrollBankingFeatureControls(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  for (const feature of PAYROLL_BANKING_FEATURE_DEFAULTS) {
    await prisma.featureControl.upsert({
      where: {
        organizationId_featureCode: {
          organizationId,
          featureCode: feature.featureCode,
        },
      },
      update: {
        // Preserve operator overrides on re-seed — only fill missing rows.
      },
      create: {
        organizationId,
        featureCode: feature.featureCode,
        isEnabled: feature.isEnabled,
        status: ConfigurationStatus.ACTIVE,
        reason: feature.reason,
      },
    });
  }
}

/** Default MANUAL_REGISTER / generic CSV profiles (placeholder — no official bank layouts). */
export async function seedBankExportProfiles(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const { DEFAULT_MANUAL_REGISTER_CONFIGURATION } = await import(
    "../src/modules/payroll/lib/bank-export-adapter"
  );

  await prisma.bankExportProfile.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "MANUAL_REGISTER",
      },
    },
    update: {
      name: "Manual payment register (CSV)",
      description:
        "Placeholder / requires bank confirmation. Generic CSV payment register — not an official bank ACH layout.",
      adapterKind: "MANUAL_REGISTER",
      isDefault: true,
      isPlaceholder: true,
      isActive: true,
      configurationJson: DEFAULT_MANUAL_REGISTER_CONFIGURATION,
    },
    create: {
      organizationId,
      code: "MANUAL_REGISTER",
      name: "Manual payment register (CSV)",
      description:
        "Placeholder / requires bank confirmation. Generic CSV payment register — not an official bank ACH layout.",
      adapterKind: "MANUAL_REGISTER",
      isDefault: true,
      isPlaceholder: true,
      isActive: true,
      configurationJson: DEFAULT_MANUAL_REGISTER_CONFIGURATION,
    },
  });

  await prisma.bankExportProfile.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "GENERIC_CSV",
      },
    },
    update: {
      name: "Generic CSV (ACH-ready placeholder)",
      description:
        "Placeholder / requires bank confirmation. Configurable generic CSV only — not an official ACH layout. Enable ACH_EXPORT_ENABLED to use for batches.",
      adapterKind: "GENERIC_CSV",
      isDefault: false,
      isPlaceholder: true,
      isActive: true,
      configurationJson: {
        ...DEFAULT_MANUAL_REGISTER_CONFIGURATION,
        fileNamePrefix: "generic-ach-csv",
        // Full account numbers in the downloadable file; maskedPreview still masks.
        maskAccountNumbers: false,
      },
    },
    create: {
      organizationId,
      code: "GENERIC_CSV",
      name: "Generic CSV (ACH-ready placeholder)",
      description:
        "Placeholder / requires bank confirmation. Configurable generic CSV only — not an official ACH layout. Enable ACH_EXPORT_ENABLED to use for batches.",
      adapterKind: "GENERIC_CSV",
      isDefault: false,
      isPlaceholder: true,
      isActive: true,
      configurationJson: {
        ...DEFAULT_MANUAL_REGISTER_CONFIGURATION,
        fileNamePrefix: "generic-ach-csv",
        maskAccountNumbers: false,
      },
    },
  });
}

/**
 * One-time copy of legacy PayrollBankAccount rows into EmployeeBankAccount
 * + EmployeePayrollAllocation when the employee has no employee bank rows yet.
 */
export async function migratePayrollBankAccountsToEmployeeBankAccounts(
  prisma: PrismaClient,
): Promise<number> {
  const institutions = await prisma.financialInstitution.findMany({
    select: {
      id: true,
      catalogKey: true,
      legalName: true,
      displayName: true,
      shortName: true,
    },
  });

  const byName = new Map<string, string>();
  for (const institution of institutions) {
    byName.set(institution.legalName.toLowerCase(), institution.id);
    byName.set(institution.displayName.toLowerCase(), institution.id);
    byName.set(institution.shortName.toLowerCase(), institution.id);
  }

  const legacyRows = await prisma.payrollBankAccount.findMany({
    include: {
      payrollProfile: {
        select: {
          employeeId: true,
          employee: {
            select: {
              organizationId: true,
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const byEmployee = new Map<string, typeof legacyRows>();
  for (const row of legacyRows) {
    const employeeId = row.payrollProfile.employeeId;
    const list = byEmployee.get(employeeId) ?? [];
    list.push(row);
    byEmployee.set(employeeId, list);
  }

  let migrated = 0;

  for (const [employeeId, accounts] of byEmployee) {
    const existing = await prisma.employeeBankAccount.count({
      where: { employeeId, isActive: true },
    });
    if (existing > 0) {
      continue;
    }

    const organizationId = accounts[0]!.payrollProfile.employee.organizationId;

    await prisma.$transaction(async (tx) => {
      for (const [index, account] of accounts.entries()) {
        const matchedId =
          byName.get(account.bankName.trim().toLowerCase()) ?? null;

        const created = await tx.employeeBankAccount.create({
          data: {
            organizationId,
            employeeId,
            financialInstitutionId: matchedId,
            bankName: account.bankName,
            branchName: account.branchName,
            accountHolderName: account.accountName,
            accountNumber: account.accountNumber,
            accountNumberLastFour: accountNumberLastFour(account.accountNumber),
            isPrimary: account.isPrimary,
            isPayrollEnabled: true,
            sortOrder: account.sortOrder ?? index,
          },
        });

        const allocationType =
          accounts.length === 1
            ? "FULL_BALANCE"
            : account.isPrimary
              ? "REMAINDER"
              : "FIXED_AMOUNT";

        await tx.employeePayrollAllocation.create({
          data: {
            organizationId,
            employeeId,
            employeeBankAccountId: created.id,
            allocationType,
            fixedAmount:
              allocationType === "FIXED_AMOUNT" && account.amount != null
                ? account.amount
                : null,
            receivesRemainder:
              allocationType === "REMAINDER" ||
              allocationType === "FULL_BALANCE",
            priority: index,
            isActive: true,
          },
        });

        migrated += 1;
      }
    });
  }

  return migrated;
}
