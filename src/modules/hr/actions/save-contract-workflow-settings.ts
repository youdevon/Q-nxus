"use server";

import { revalidatePath } from "next/cache";

import { ConfigurationStatus, SettingDataType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  CONTRACT_WORKFLOW_SETTING_CODE,
  contractWorkflowRequiresFinalApprover,
  isContractWorkflowMode,
  parseContractWorkflowSettings,
  type ContractWorkflowSettings,
} from "@/src/modules/hr/lib/contract-workflow-settings";

export type ContractWorkflowFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveContractWorkflowSettings(
  _previousState: ContractWorkflowFormState,
  formData: FormData,
): Promise<ContractWorkflowFormState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  let user;

  try {
    user = await requireCurrentUser();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An active user account is required.",
    };
  }

  const organizationId = user.employee?.organizationId ?? user.organizationId;
  const modeRaw = textValue(formData, "mode");
  const finalApproverPositionId = textValue(
    formData,
    "finalApproverPositionId",
  );
  const requireDualSignature =
    formData.get("requireDualSignature") === "on" ||
    formData.get("requireDualSignature") === "true";

  if (!isContractWorkflowMode(modeRaw)) {
    return {
      status: "error",
      message: "Select a valid contract approval mode.",
    };
  }

  if (
    contractWorkflowRequiresFinalApprover(modeRaw) &&
    !finalApproverPositionId
  ) {
    return {
      status: "error",
      message: "Select the final approver position for contract approvals.",
    };
  }

  if (finalApproverPositionId) {
    const position = await prisma.position.findFirst({
      where: {
        id: finalApproverPositionId,
        isActive: true,
        department: {
          organizationId,
        },
      },
      select: { id: true },
    });

    if (!position) {
      return {
        status: "error",
        message: "The selected final approver position was not found.",
      };
    }
  }

  const nextValue: ContractWorkflowSettings = {
    mode: modeRaw,
    finalApproverPositionId: finalApproverPositionId || null,
    requireDualSignature,
  };

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const existing = await prisma.domainSetting.findUnique({
      where: {
        organizationId_settingCode: {
          organizationId,
          settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
        },
      },
      select: { id: true, value: true },
    });

    if (existing) {
      await prisma.domainSetting.update({
        where: { id: existing.id },
        data: {
          value: nextValue,
          status: ConfigurationStatus.ACTIVE,
          version: { increment: 1 },
        },
      });
    } else {
      await prisma.domainSetting.create({
        data: {
          organizationId,
          settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
          moduleKey: "hr",
          name: "Contract approval workflow",
          description:
            "Controls employment contract approval and dual-signature requirements before activation.",
          dataType: SettingDataType.JSON,
          value: nextValue,
          status: ConfigurationStatus.ACTIVE,
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "DomainSetting",
        entityId: CONTRACT_WORKFLOW_SETTING_CODE,
        description: "Updated contract approval workflow settings.",
        oldValues: existing
          ? (parseContractWorkflowSettings(existing.value) as object)
          : undefined,
        newValues: nextValue as object,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/contracts");
    revalidatePath("/contracts/workflow");

    return {
      status: "success",
      message: "Contract workflow settings saved.",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Unable to save contract workflow settings.",
    };
  }
}
