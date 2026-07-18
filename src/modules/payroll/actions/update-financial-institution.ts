"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

export type FinancialInstitutionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateFinancialInstitution(
  _previous: FinancialInstitutionFormState,
  formData: FormData,
): Promise<FinancialInstitutionFormState> {
  const actor = await requireActor(
    "payroll.financial_institutions.manage",
    "payroll.manage",
  );

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
    ))
  ) {
    return {
      status: "error",
      message: "Payroll banking is disabled for this organization.",
    };
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
  // Placeholder fields — never invent official codes; store only what admins enter.
  const routingCode = textValue(formData, "routingCode") || null;
  const achParticipantCode = textValue(formData, "achParticipantCode") || null;
  const localInstitutionCode =
    textValue(formData, "localInstitutionCode") || null;

  const existing = await prisma.financialInstitution.findUnique({
    where: { id },
  });

  if (!existing) {
    return { status: "error", message: "Institution not found." };
  }

  const updated = await prisma.financialInstitution.update({
    where: { id },
    data: {
      isActive,
      isSelectableForEmployees,
      supportsPayrollDeposits,
      supportsAchCredits,
      routingCode,
      achParticipantCode,
      localInstitutionCode,
      archivedAt: isActive ? null : (existing.archivedAt ?? new Date()),
    },
  });

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const metadata = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: organization?.id ?? null,
    moduleKey: "payroll",
    action: "UPDATE",
    entityType: "FinancialInstitution",
    entityId: updated.id,
    description: `Updated financial institution ${updated.displayName}.`,
    oldValues: {
      isActive: existing.isActive,
      isSelectableForEmployees: existing.isSelectableForEmployees,
      supportsPayrollDeposits: existing.supportsPayrollDeposits,
      supportsAchCredits: existing.supportsAchCredits,
      routingCode: existing.routingCode,
      achParticipantCode: existing.achParticipantCode,
      localInstitutionCode: existing.localInstitutionCode,
    },
    newValues: {
      isActive: updated.isActive,
      isSelectableForEmployees: updated.isSelectableForEmployees,
      supportsPayrollDeposits: updated.supportsPayrollDeposits,
      supportsAchCredits: updated.supportsAchCredits,
      routingCode: updated.routingCode,
      achParticipantCode: updated.achParticipantCode,
      localInstitutionCode: updated.localInstitutionCode,
    },
    ...metadata,
  });

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/institutions");

  return {
    status: "success",
    message: `Saved ${updated.displayName}.`,
  };
}
