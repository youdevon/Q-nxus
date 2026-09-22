"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ConfigurationStatus } from "@/generated/prisma/enums";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { PAYROLL_BANKING_FEATURE_FLAGS } from "@/src/modules/payroll/lib/payroll-banking-flags";

export type AchExportToggleState = {
  status: "idle" | "success" | "error";
  message: string;
};

/**
 * Toggle organization ACH file export (FeatureControl ACH_EXPORT_ENABLED).
 */
export async function setAchExportEnabled(
  _previous: AchExportToggleState,
  formData: FormData,
): Promise<AchExportToggleState> {
  const actor = await requireActor("payroll.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const enabledRaw = formData.get("enabled");
  const isEnabled =
    enabledRaw === "true" || enabledRaw === "on" || enabledRaw === "1";

  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    return { status: "error", message: "Organization is required." };
  }

  const featureCode = PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED;
  const reason = isEnabled
    ? "Enabled from Payroll Settings."
    : "Disabled from Payroll Settings.";

  const previous = await prisma.featureControl.findUnique({
    where: {
      organizationId_featureCode: { organizationId, featureCode },
    },
    select: { isEnabled: true },
  });

  await prisma.featureControl.upsert({
    where: {
      organizationId_featureCode: { organizationId, featureCode },
    },
    update: {
      isEnabled,
      status: ConfigurationStatus.ACTIVE,
      reason,
    },
    create: {
      organizationId,
      featureCode,
      isEnabled,
      status: ConfigurationStatus.ACTIVE,
      reason,
    },
  });

  const metadata = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId,
    moduleKey: "payroll",
    action: isEnabled ? "ENABLE_ACH_EXPORT" : "DISABLE_ACH_EXPORT",
    entityType: "FeatureControl",
    entityId: featureCode,
    description: reason,
    oldValues: { isEnabled: previous?.isEnabled ?? false },
    newValues: { isEnabled, featureCode },
    ...metadata,
  });

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/runs");
  revalidatePath("/payroll/settings/export-profiles");

  return {
    status: "success",
    message: isEnabled
      ? "ACH export enabled. Use Generate ACH on posted pay runs."
      : "ACH export disabled.",
  };
}
