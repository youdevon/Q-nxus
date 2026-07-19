"use server";

import { revalidatePath } from "next/cache";

import { ConfigurationStatus, SettingDataType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  DEFAULT_LEAVE_WORKFLOW_SETTINGS,
  isLeaveWorkflowMode,
  LEAVE_WORKFLOW_SETTING_CODE,
  leaveWorkflowRequiresFinalApprover,
  parseLeaveWorkflowSettings,
  type LeaveWorkflowSettings,
} from "@/src/modules/hr/lib/leave-workflow-settings";
import {
  DEFAULT_LEAVE_FORFEITURE_SETTINGS,
  LEAVE_FORFEITURE_SETTING_CODE,
  parseLeaveForfeitureSettings,
  type LeaveForfeitureSettings,
} from "@/src/modules/hr/lib/leave-forfeiture-settings";

export type LeaveWorkflowFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveLeaveWorkflowSettings(
  _previousState: LeaveWorkflowFormState,
  formData: FormData,
): Promise<LeaveWorkflowFormState> {
  const actor = await requireActor("leave.manage");

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

  const organizationId =
    user.employee?.organizationId ?? user.organizationId;

  const modeRaw = textValue(formData, "mode");
  const finalApproverPositionId = textValue(formData, "finalApproverPositionId");
  const ackOrderRaw = textValue(formData, "ackOrder");
  const requireAllAcksBeforeFinal =
    formData.get("requireAllAcksBeforeFinal") === "on" ||
    formData.get("requireAllAcksBeforeFinal") === "true";

  if (!isLeaveWorkflowMode(modeRaw)) {
    return {
      status: "error",
      message: "Select a valid leave approval mode.",
    };
  }

  if (
    leaveWorkflowRequiresFinalApprover(modeRaw) &&
    !finalApproverPositionId
  ) {
    return {
      status: "error",
      message:
        "Select the final approver position (for example, General Manager).",
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

  const nextValue: LeaveWorkflowSettings = {
    mode: modeRaw,
    finalApproverPositionId: finalApproverPositionId || null,
    requireAllAcksBeforeFinal,
    ackOrder: ackOrderRaw === "SEQUENTIAL" ? "SEQUENTIAL" : "ANY",
  };

  const hrRoleCodesRaw = textValue(formData, "notifyHrRoleCodes");
  const forfeitureValue: LeaveForfeitureSettings = {
    notifyEmployee:
      formData.get("notifyEmployee") === "on" ||
      formData.get("notifyEmployee") === "true",
    notifySupervisor:
      formData.get("notifySupervisor") === "on" ||
      formData.get("notifySupervisor") === "true",
    notifyLeaveManagers:
      formData.get("notifyLeaveManagers") === "on" ||
      formData.get("notifyLeaveManagers") === "true",
    sendEmailAlerts:
      formData.get("sendEmailAlerts") === "on" ||
      formData.get("sendEmailAlerts") === "true",
    notifyHrRoleCodes: hrRoleCodesRaw
      .split(/[,;\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0),
  };

  if (forfeitureValue.notifyHrRoleCodes.length === 0) {
    forfeitureValue.notifyHrRoleCodes = [
      ...DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifyHrRoleCodes,
    ];
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const existing = await prisma.domainSetting.findUnique({
      where: {
        organizationId_settingCode: {
          organizationId,
          settingCode: LEAVE_WORKFLOW_SETTING_CODE,
        },
      },
      select: {
        id: true,
        value: true,
        version: true,
      },
    });

    if (existing) {
      await prisma.domainSetting.update({
        where: { id: existing.id },
        data: {
          value: nextValue,
          version: existing.version + 1,
          status: ConfigurationStatus.ACTIVE,
          name: "Leave approval workflow",
          description:
            "Controls leave acknowledgement and final approval behaviour. Final approver is a Position (typically General Manager).",
          dataType: SettingDataType.JSON,
          moduleKey: "leave",
        },
      });
    } else {
      await prisma.domainSetting.create({
        data: {
          organizationId,
          settingCode: LEAVE_WORKFLOW_SETTING_CODE,
          moduleKey: "leave",
          name: "Leave approval workflow",
          description:
            "Controls leave acknowledgement and final approval behaviour. Final approver is a Position (typically General Manager).",
          dataType: SettingDataType.JSON,
          value: nextValue,
          status: ConfigurationStatus.ACTIVE,
        },
      });
    }

    const existingForfeiture = await prisma.domainSetting.findUnique({
      where: {
        organizationId_settingCode: {
          organizationId,
          settingCode: LEAVE_FORFEITURE_SETTING_CODE,
        },
      },
      select: {
        id: true,
        value: true,
        version: true,
      },
    });

    if (existingForfeiture) {
      await prisma.domainSetting.update({
        where: { id: existingForfeiture.id },
        data: {
          value: forfeitureValue,
          version: existingForfeiture.version + 1,
          status: ConfigurationStatus.ACTIVE,
          name: "Vacation use-or-lose alerts",
          description:
            "Controls who receives vacation forfeiture reminders near contract end.",
          dataType: SettingDataType.JSON,
          moduleKey: "leave",
        },
      });
    } else {
      await prisma.domainSetting.create({
        data: {
          organizationId,
          settingCode: LEAVE_FORFEITURE_SETTING_CODE,
          moduleKey: "leave",
          name: "Vacation use-or-lose alerts",
          description:
            "Controls who receives vacation forfeiture reminders near contract end.",
          dataType: SettingDataType.JSON,
          value: forfeitureValue,
          status: ConfigurationStatus.ACTIVE,
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "DomainSetting",
        entityId: LEAVE_WORKFLOW_SETTING_CODE,
        description: "Updated leave approval workflow and forfeiture settings.",
        oldValues: {
          workflow: existing
            ? parseLeaveWorkflowSettings(existing.value)
            : DEFAULT_LEAVE_WORKFLOW_SETTINGS,
          forfeiture: existingForfeiture
            ? parseLeaveForfeitureSettings(existingForfeiture.value)
            : DEFAULT_LEAVE_FORFEITURE_SETTINGS,
        },
        newValues: {
          workflow: nextValue,
          forfeiture: forfeitureValue,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/leave/workflow");
    revalidatePath("/administration/settings");
    revalidatePath("/people/leave");

    return {
      status: "success",
      message: "Leave workflow settings saved.",
    };
  } catch (error) {
    console.error("Unable to save leave workflow settings:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Leave workflow settings could not be saved.",
    };
  }
}
