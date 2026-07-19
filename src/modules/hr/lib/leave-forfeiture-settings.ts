/**
 * Org-scoped vacation use-or-lose (forfeiture) reminder settings
 * (DomainSetting `leave.forfeiture`).
 */

export const LEAVE_FORFEITURE_SETTING_CODE = "leave.forfeiture";

export type LeaveForfeitureSettings = {
  /** Notify the employee (when they have a linked active user). */
  notifyEmployee: boolean;
  /** Notify the reporting-line supervisor. */
  notifySupervisor: boolean;
  /** Notify users holding these role codes (e.g. HR_ADMINISTRATOR). */
  notifyHrRoleCodes: string[];
  /** Also notify anyone with the leave.manage permission. */
  notifyLeaveManagers: boolean;
  /** Also queue email for recipients who have an email address. */
  sendEmailAlerts: boolean;
};

export const DEFAULT_LEAVE_FORFEITURE_SETTINGS: LeaveForfeitureSettings = {
  notifyEmployee: true,
  notifySupervisor: true,
  notifyHrRoleCodes: ["HR_ADMINISTRATOR"],
  notifyLeaveManagers: true,
  sendEmailAlerts: true,
};

function parseRoleCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifyHrRoleCodes];
  }

  const codes = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0);

  return codes.length > 0
    ? [...new Set(codes)]
    : [...DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifyHrRoleCodes];
}

export function parseLeaveForfeitureSettings(
  value: unknown,
): LeaveForfeitureSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_LEAVE_FORFEITURE_SETTINGS };
  }

  const record = value as Record<string, unknown>;

  return {
    notifyEmployee:
      typeof record.notifyEmployee === "boolean"
        ? record.notifyEmployee
        : DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifyEmployee,
    notifySupervisor:
      typeof record.notifySupervisor === "boolean"
        ? record.notifySupervisor
        : DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifySupervisor,
    notifyHrRoleCodes: parseRoleCodes(record.notifyHrRoleCodes),
    notifyLeaveManagers:
      typeof record.notifyLeaveManagers === "boolean"
        ? record.notifyLeaveManagers
        : DEFAULT_LEAVE_FORFEITURE_SETTINGS.notifyLeaveManagers,
    sendEmailAlerts:
      typeof record.sendEmailAlerts === "boolean"
        ? record.sendEmailAlerts
        : DEFAULT_LEAVE_FORFEITURE_SETTINGS.sendEmailAlerts,
  };
}
