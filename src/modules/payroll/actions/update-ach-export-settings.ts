"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  parseAchExportSettings,
  type AchExportSettings,
} from "@/src/modules/payroll/lib/ach/ach-settings";
import { saveAchExportSettings } from "@/src/modules/payroll/data/get-ach-settings";
import { setAchExportEnabled } from "@/src/modules/payroll/actions/set-ach-export-enabled";

export type AchSettingsFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAchExportSettings(
  _previous: AchSettingsFormState,
  formData: FormData,
): Promise<AchSettingsFormState> {
  const actor = await requireActor(
    "payroll.ach.configure",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    return { status: "error", message: "Organization is required." };
  }

  const enabled = formData.get("enabled") === "on";
  const forceLegacy = formData.get("transactionCodePolicy") === "FORCE_LEGACY_CODE";
  const legacyCode = textValue(formData, "legacyTransactionCode") === "22" ? "22" : "32";

  const next: AchExportSettings = parseAchExportSettings({
    enabled,
    exportFormat: textValue(formData, "exportFormat") || undefined,
    transactionCodePolicy: forceLegacy ? "FORCE_LEGACY_CODE" : "USE_ACCOUNT_TYPE",
    legacyTransactionCode: legacyCode,
    odfiRoutingNumber: textValue(formData, "odfiRoutingNumber"),
    entryDescription: textValue(formData, "entryDescription") || "Salary",
    allowExportWithWarnings: formData.get("allowExportWithWarnings") === "on",
    discretionaryData: textValue(formData, "discretionaryData") || "  ",
  });

  // Keep FeatureControl in sync with the settings form checkbox.
  const enableForm = new FormData();
  enableForm.set("enabled", enabled ? "true" : "false");
  const toggleResult = await setAchExportEnabled(
    { status: "idle", message: "" },
    enableForm,
  );
  if (toggleResult.status === "error") {
    return toggleResult;
  }

  const saved = await saveAchExportSettings({
    organizationId,
    settings: next,
  });

  const metadata = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId,
    moduleKey: "payroll",
    action: "UPDATE_ACH_SETTINGS",
    entityType: "DomainSetting",
    entityId: "payroll.ach.export_settings",
    description: "Updated FCB ACH export settings.",
    newValues: saved as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
    ...metadata,
  });

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/ach");
  revalidatePath("/payroll/settings/ach/banks");

  return {
    status: "success",
    message: "ACH export settings saved.",
  };
}
