"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { FinancialInstitutionType } from "@/generated/prisma/client";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { digitsOnly } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { isValidNachaCheckDigit } from "@/src/modules/payroll/lib/ach/ach-routing";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

export type FinancialInstitutionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INSTITUTION_TYPES = new Set<FinancialInstitutionType>([
  "COMMERCIAL_BANK",
  "CREDIT_UNION",
  "BUILDING_SOCIETY",
  "LICENSED_NON_BANK",
  "ELECTRONIC_MONEY",
  "INVESTMENT_MORTGAGE_DEVELOPMENT",
  "CREDIT_UNION_SUPPORT",
  "OTHER",
]);

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalPositiveInt(
  formData: FormData,
  key: string,
): number | null {
  const raw = textValue(formData, key);
  if (!raw) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 17) {
    return null;
  }
  return n;
}

async function assertBankingEnabled(): Promise<string | null> {
  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
    ))
  ) {
    return "Payroll banking is disabled for this organization.";
  }
  return null;
}

function validateRoutingForAch(input: {
  routingCode: string | null;
  supportsAchCredits: boolean;
}): string | null {
  if (!input.routingCode) {
    if (input.supportsAchCredits) {
      return "ACH credits require a 9-digit routing number.";
    }
    return null;
  }
  const digits = digitsOnly(input.routingCode);
  if (digits.length !== 9) {
    return "Routing number must be exactly 9 digits.";
  }
  if (!isValidNachaCheckDigit(digits)) {
    return `Routing ${digits} fails the NACHA 3-7-1 check digit.`;
  }
  return null;
}

function parseInstitutionType(raw: string): FinancialInstitutionType {
  if (INSTITUTION_TYPES.has(raw as FinancialInstitutionType)) {
    return raw as FinancialInstitutionType;
  }
  return "COMMERCIAL_BANK";
}

function revalidateInstitutionPaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/institutions");
  revalidatePath("/payroll/settings/ach");
  revalidatePath("/payroll/settings/ach/banks");
}

export async function updateFinancialInstitution(
  _previous: FinancialInstitutionFormState,
  formData: FormData,
): Promise<FinancialInstitutionFormState> {
  const actor = await requireActor(
    "payroll.financial_institutions.manage",
    "payroll.manage",
    "payroll.ach.configure",
  );

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const bankingError = await assertBankingEnabled();
  if (bankingError) {
    return { status: "error", message: bankingError };
  }

  const id = textValue(formData, "id");
  if (!id) {
    return { status: "error", message: "Missing institution id." };
  }

  const isActive = formData.get("isActive") === "on";
  const isSelectableForEmployees =
    formData.get("isSelectableForEmployees") === "on";
  const supportsPayrollDeposits =
    formData.get("supportsPayrollDeposits") === "on";
  const supportsAchCredits = formData.get("supportsAchCredits") === "on";
  const routingRaw = textValue(formData, "routingCode");
  const routingCode = routingRaw ? digitsOnly(routingRaw) : null;
  const achParticipantCode = textValue(formData, "achParticipantCode") || null;
  const localInstitutionCode =
    textValue(formData, "localInstitutionCode") || null;
  const accountNumberMinLength = optionalPositiveInt(
    formData,
    "accountNumberMinLength",
  );
  const accountNumberMaxLength = optionalPositiveInt(
    formData,
    "accountNumberMaxLength",
  );

  if (
    accountNumberMinLength != null &&
    accountNumberMaxLength != null &&
    accountNumberMinLength > accountNumberMaxLength
  ) {
    return {
      status: "error",
      message: "Account min length cannot exceed max length.",
    };
  }

  const routingError = validateRoutingForAch({
    routingCode,
    supportsAchCredits,
  });
  if (routingError) {
    return { status: "error", message: routingError };
  }

  if (routingCode) {
    const clash = await prisma.financialInstitution.findFirst({
      where: {
        routingCode,
        id: { not: id },
        isActive: true,
        archivedAt: null,
      },
      select: { displayName: true },
    });
    if (clash) {
      return {
        status: "error",
        message: `Routing ${routingCode} is already used by ${clash.displayName}.`,
      };
    }
  }

  const existing = await prisma.financialInstitution.findUnique({
    where: { id },
  });

  if (!existing) {
    return { status: "error", message: "Institution not found." };
  }

  const displayName =
    textValue(formData, "displayName") || existing.displayName;
  const shortName = textValue(formData, "shortName") || existing.shortName;
  const legalName = textValue(formData, "legalName") || existing.legalName;

  const updated = await prisma.financialInstitution.update({
    where: { id },
    data: {
      legalName,
      displayName,
      shortName,
      isActive,
      isSelectableForEmployees,
      supportsPayrollDeposits,
      supportsAchCredits,
      routingCode,
      achParticipantCode,
      localInstitutionCode,
      accountNumberMinLength,
      accountNumberMaxLength,
      archivedAt: isActive ? null : (existing.archivedAt ?? new Date()),
    },
  });

  const organizationId = await getSessionOrganizationId();
  const metadata = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: organizationId ?? null,
    moduleKey: "payroll",
    action: "UPDATE",
    entityType: "FinancialInstitution",
    entityId: updated.id,
    description: `Updated financial institution ${updated.displayName}.`,
    oldValues: {
      isActive: existing.isActive,
      supportsAchCredits: existing.supportsAchCredits,
      routingCode: existing.routingCode,
      accountNumberMinLength: existing.accountNumberMinLength,
      accountNumberMaxLength: existing.accountNumberMaxLength,
    },
    newValues: {
      isActive: updated.isActive,
      supportsAchCredits: updated.supportsAchCredits,
      routingCode: updated.routingCode,
      accountNumberMinLength: updated.accountNumberMinLength,
      accountNumberMaxLength: updated.accountNumberMaxLength,
    },
    ...metadata,
  });

  revalidateInstitutionPaths();

  return {
    status: "success",
    message: `Saved ${updated.displayName}.`,
  };
}

/**
 * Manually add a bank (typically a new ACH participant) without re-seeding.
 */
export async function createFinancialInstitution(
  _previous: FinancialInstitutionFormState,
  formData: FormData,
): Promise<FinancialInstitutionFormState> {
  const actor = await requireActor(
    "payroll.financial_institutions.manage",
    "payroll.manage",
    "payroll.ach.configure",
  );

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const bankingError = await assertBankingEnabled();
  if (bankingError) {
    return { status: "error", message: bankingError };
  }

  const legalName = textValue(formData, "legalName");
  const displayName = textValue(formData, "displayName") || legalName;
  const shortName = textValue(formData, "shortName");
  if (!legalName || !shortName) {
    return {
      status: "error",
      message: "Legal name and short name are required.",
    };
  }

  const supportsAchCredits = formData.get("supportsAchCredits") === "on";
  const isSelectableForEmployees =
    formData.get("isSelectableForEmployees") === "on";
  const supportsPayrollDeposits =
    formData.get("supportsPayrollDeposits") === "on";
  const routingRaw = textValue(formData, "routingCode");
  const routingCode = routingRaw ? digitsOnly(routingRaw) : null;
  const achParticipantCode = textValue(formData, "achParticipantCode") || null;
  const accountNumberMinLength = optionalPositiveInt(
    formData,
    "accountNumberMinLength",
  );
  const accountNumberMaxLength = optionalPositiveInt(
    formData,
    "accountNumberMaxLength",
  );
  const institutionType = parseInstitutionType(
    textValue(formData, "institutionType"),
  );

  const routingError = validateRoutingForAch({
    routingCode,
    supportsAchCredits,
  });
  if (routingError) {
    return { status: "error", message: routingError };
  }

  if (
    accountNumberMinLength != null &&
    accountNumberMaxLength != null &&
    accountNumberMinLength > accountNumberMaxLength
  ) {
    return {
      status: "error",
      message: "Account min length cannot exceed max length.",
    };
  }

  if (routingCode) {
    const clash = await prisma.financialInstitution.findFirst({
      where: {
        routingCode,
        isActive: true,
        archivedAt: null,
      },
      select: { displayName: true },
    });
    if (clash) {
      return {
        status: "error",
        message: `Routing ${routingCode} is already used by ${clash.displayName}.`,
      };
    }
  }

  const created = await prisma.financialInstitution.create({
    data: {
      legalName,
      displayName,
      shortName,
      institutionType,
      countryCode: "TT",
      currencyCode: "TTD",
      routingCode,
      achParticipantCode,
      accountNumberMinLength,
      accountNumberMaxLength,
      supportsAchCredits,
      supportsAchDebits: false,
      supportsPayrollDeposits,
      isSelectableForEmployees,
      isActive: true,
      catalogKey: null,
    },
  });

  const organizationId = await getSessionOrganizationId();
  const metadata = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: organizationId ?? null,
    moduleKey: "payroll",
    action: "CREATE",
    entityType: "FinancialInstitution",
    entityId: created.id,
    description: `Created financial institution ${created.displayName}.`,
    newValues: {
      displayName: created.displayName,
      routingCode: created.routingCode,
      supportsAchCredits: created.supportsAchCredits,
    },
    ...metadata,
  });

  revalidateInstitutionPaths();

  return {
    status: "success",
    message: `Added ${created.displayName}.`,
  };
}
