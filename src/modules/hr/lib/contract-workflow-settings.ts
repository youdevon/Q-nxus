/**
 * Org-scoped employment contract approval workflow (DomainSetting `contracts.workflow`).
 * Modes match the Prisma `ContractWorkflowMode` enum.
 */

import {
  ContractWorkflowMode as ContractWorkflowModeEnum,
  type ContractWorkflowMode,
} from "@/generated/prisma/client";

export type { ContractWorkflowMode };

export const CONTRACT_WORKFLOW_SETTING_CODE = "contracts.workflow";

export const CONTRACT_WORKFLOW_MODES = [
  ContractWorkflowModeEnum.PEOPLE_MANAGE_AUTO,
  ContractWorkflowModeEnum.FINAL_APPROVER_POSITION,
] as const;

export type ContractWorkflowSettings = {
  mode: ContractWorkflowMode;
  /** Position id of the final contract approver when mode is FINAL_APPROVER_POSITION. */
  finalApproverPositionId: string | null;
  /** When true, both employee and org must sign before activate. */
  requireDualSignature: boolean;
};

export const DEFAULT_CONTRACT_WORKFLOW_SETTINGS: ContractWorkflowSettings = {
  mode: ContractWorkflowModeEnum.PEOPLE_MANAGE_AUTO,
  finalApproverPositionId: null,
  requireDualSignature: true,
};

const MODE_SET = new Set<string>(CONTRACT_WORKFLOW_MODES);

export function isContractWorkflowMode(
  value: unknown,
): value is ContractWorkflowMode {
  return typeof value === "string" && MODE_SET.has(value);
}

export function parseContractWorkflowSettings(
  value: unknown,
): ContractWorkflowSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CONTRACT_WORKFLOW_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  const mode = isContractWorkflowMode(record.mode)
    ? record.mode
    : DEFAULT_CONTRACT_WORKFLOW_SETTINGS.mode;

  const finalApproverPositionId =
    typeof record.finalApproverPositionId === "string" &&
    record.finalApproverPositionId.trim().length > 0
      ? record.finalApproverPositionId.trim()
      : null;

  const requireDualSignature =
    typeof record.requireDualSignature === "boolean"
      ? record.requireDualSignature
      : DEFAULT_CONTRACT_WORKFLOW_SETTINGS.requireDualSignature;

  return {
    mode,
    finalApproverPositionId,
    requireDualSignature,
  };
}

export function contractWorkflowRequiresFinalApprover(
  mode: ContractWorkflowMode,
): boolean {
  return mode === ContractWorkflowModeEnum.FINAL_APPROVER_POSITION;
}

export function contractWorkflowModeLabel(mode: ContractWorkflowMode): string {
  switch (mode) {
    case ContractWorkflowModeEnum.PEOPLE_MANAGE_AUTO:
      return "HR / contracts managers (auto-approve)";
    case ContractWorkflowModeEnum.FINAL_APPROVER_POSITION:
      return "Final approver position";
    default:
      return mode;
  }
}
