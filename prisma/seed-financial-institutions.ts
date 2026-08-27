import { createHash } from "node:crypto";

import type { FinancialInstitutionType, PrismaClient } from "../generated/prisma/client";
import {
  TT_FINANCIAL_INSTITUTIONS,
  type TtFinancialInstitutionCategoryId,
} from "../src/modules/payroll/lib/tt-financial-institutions";
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
 * Known ABA / routing codes from the TT bank participant list are written to
 * `routingCode`. Institutions without a catalog code keep routing null (or
 * preserve any operator-set value on re-seed).
 * Other catalog entries: selectable for employees, supportsAchCredits=false.
 */
export async function seedFinancialInstitutions(
  prisma: PrismaClient,
): Promise<void> {
  for (const entry of TT_FINANCIAL_INSTITUTIONS) {
    const isCommercial = COMMERCIAL_BANK_CATALOG_KEYS.has(entry.id);
    const id = stableInstitutionId(entry.id);
    const routingCode = entry.routingCode?.trim() || null;

    await prisma.financialInstitution.upsert({
      where: { catalogKey: entry.id },
      update: {
        legalName: entry.name,
        displayName: entry.name,
        shortName: entry.shortName,
        institutionType: mapCategoryToType(entry.category),
        countryCode: "TT",
        currencyCode: "TTD",
        // Apply catalog ABA when known; otherwise leave operator-confirmed codes.
        ...(routingCode ? { routingCode } : {}),
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
        achParticipantCode: null,
        routingCode,
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

/** Default MANUAL_REGISTER / generic CSV / First Citizens profiles. */
export async function seedBankExportProfiles(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const { DEFAULT_MANUAL_REGISTER_CONFIGURATION } = await import(
    "../src/modules/payroll/lib/bank-export-adapter"
  );
  const { DEFAULT_FIRST_CITIZENS_CONFIGURATION } = await import(
    "../src/modules/payroll/lib/first-citizens-export"
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

  await prisma.bankExportProfile.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "FCB_MANUAL_WORKSHEET",
      },
    },
    update: {
      name: "First Citizens manual-entry worksheet",
      description:
        "Control document matching First Citizens Business Online template columns. NOT a bank import file — use for manual entry or checking.",
      adapterKind: "FIRST_CITIZENS_MANUAL_WORKSHEET",
      isDefault: false,
      isPlaceholder: false,
      isActive: true,
      configurationJson: DEFAULT_FIRST_CITIZENS_CONFIGURATION,
    },
    create: {
      organizationId,
      code: "FCB_MANUAL_WORKSHEET",
      name: "First Citizens manual-entry worksheet",
      description:
        "Control document matching First Citizens Business Online template columns. NOT a bank import file — use for manual entry or checking.",
      adapterKind: "FIRST_CITIZENS_MANUAL_WORKSHEET",
      isDefault: false,
      isPlaceholder: false,
      isActive: true,
      configurationJson: DEFAULT_FIRST_CITIZENS_CONFIGURATION,
    },
  });

  await prisma.bankExportProfile.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "FCB_IMPORT",
      },
    },
    update: {
      name: "First Citizens import file (disabled)",
      description:
        "Disabled until First Citizens confirms Default Transactions / NACHA layout. Do not label downloads as bank-compatible.",
      adapterKind: "FIRST_CITIZENS_IMPORT",
      isDefault: false,
      isPlaceholder: true,
      isActive: true,
      configurationJson: {
        ...DEFAULT_FIRST_CITIZENS_CONFIGURATION,
        exportFormat: "IMPORT_DISABLED",
        importFileDisabled: true,
      },
    },
    create: {
      organizationId,
      code: "FCB_IMPORT",
      name: "First Citizens import file (disabled)",
      description:
        "Disabled until First Citizens confirms Default Transactions / NACHA layout. Do not label downloads as bank-compatible.",
      adapterKind: "FIRST_CITIZENS_IMPORT",
      isDefault: false,
      isPlaceholder: true,
      isActive: true,
      configurationJson: {
        ...DEFAULT_FIRST_CITIZENS_CONFIGURATION,
        exportFormat: "IMPORT_DISABLED",
        importFileDisabled: true,
      },
    },
  });
}
