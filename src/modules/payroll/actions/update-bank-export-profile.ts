"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { prepareFirstCitizensConfigurationForStorage } from "@/src/modules/payroll/lib/first-citizens-export";

export type BankExportProfileFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isFirstCitizensAdapter(adapterKind: string): boolean {
  return (
    adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET" ||
    adapterKind === "FIRST_CITIZENS_IMPORT"
  );
}

/**
 * Ops-safe edits for bank export profiles (placeholders stay placeholders).
 * First Citizens profiles are normalized to Business Online ACH header defaults.
 */
export async function updateBankExportProfile(
  _previous: BankExportProfileFormState,
  formData: FormData,
): Promise<BankExportProfileFormState> {
  const actor = await requireActor(
    "payroll.bank_export_profiles.manage",
    "payroll.manage",
  );

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const id = textValue(formData, "id");
  if (!id) {
    return { status: "error", message: "Missing profile id." };
  }

  const name = textValue(formData, "name");
  if (!name) {
    return { status: "error", message: "Name is required." };
  }

  const description = textValue(formData, "description") || null;
  const isActive = formData.get("isActive") === "on";
  const configurationRaw = textValue(formData, "configurationJson");

  let configurationJson: Prisma.InputJsonValue | undefined;
  if (configurationRaw) {
    try {
      configurationJson = JSON.parse(configurationRaw) as Prisma.InputJsonValue;
    } catch {
      return {
        status: "error",
        message: "configurationJson must be valid JSON.",
      };
    }
  }

  const existing = await prisma.bankExportProfile.findUnique({
    where: { id },
  });

  if (!existing) {
    return { status: "error", message: "Export profile not found." };
  }

  if (configurationJson !== undefined && isFirstCitizensAdapter(existing.adapterKind)) {
    const prepared = prepareFirstCitizensConfigurationForStorage(configurationJson);
    if (!prepared.ok) {
      return {
        status: "error",
        message: prepared.errors.join(" "),
      };
    }
    configurationJson = prepared.config as Prisma.InputJsonValue;
  }

  const updated = await prisma.bankExportProfile.update({
    where: { id },
    data: {
      name,
      description,
      isActive,
      ...(configurationJson !== undefined ? { configurationJson } : {}),
      // Keep seeded placeholder flag — ops cannot clear REQUIRES_CONFIRMATION via UI.
      isPlaceholder: existing.isPlaceholder,
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
    entityType: "BankExportProfile",
    entityId: updated.id,
    description: `Updated bank export profile ${updated.code}.`,
    oldValues: {
      name: existing.name,
      description: existing.description,
      isActive: existing.isActive,
      isPlaceholder: existing.isPlaceholder,
    },
    newValues: {
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
      isPlaceholder: updated.isPlaceholder,
      configurationUpdated: configurationJson !== undefined,
    },
    ...metadata,
  });

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/export-profiles");

  return {
    status: "success",
    message: `Saved ${updated.name}.`,
  };
}
