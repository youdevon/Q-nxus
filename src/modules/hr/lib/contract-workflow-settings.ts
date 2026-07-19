/**
 * Org-scoped employment contract approval workflow (DomainSetting `contracts.workflow`).
 * Mode string values match the Prisma `ContractWorkflowMode` enum (keep in sync).
 *
 * Keep this module free of Node / Prisma client imports — it is used from client components.
 */

export const CONTRACT_WORKFLOW_SETTING_CODE = "contracts.workflow";

export const CONTRACT_WORKFLOW_MODES = [
  "PEOPLE_MANAGE_AUTO",
  "FINAL_APPROVER_POSITION",
] as const;

export type ContractWorkflowMode = (typeof CONTRACT_WORKFLOW_MODES)[number];

export type ContractWorkflowSettings = {
  mode: ContractWorkflowMode;
  /** Position id of the final contract approver when mode is FINAL_APPROVER_POSITION. */
  finalApproverPositionId: string | null;
  /** When true, both employee and org must sign before activate. */
  requireDualSignature: boolean;
};

export const DEFAULT_CONTRACT_WORKFLOW_SETTINGS: ContractWorkflowSettings = {
  mode: "PEOPLE_MANAGE_AUTO",
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
  return mode === "FINAL_APPROVER_POSITION";
}

export function contractWorkflowModeLabel(mode: ContractWorkflowMode): string {
  switch (mode) {
    case "PEOPLE_MANAGE_AUTO":
      return "HR / contracts managers (auto-approve)";
    case "FINAL_APPROVER_POSITION":
      return "Final approver position";
    default:
      return mode;
  }
}
