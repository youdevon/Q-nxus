/**
 * Display grouping for the role permission picker.
 * Maps Permission.moduleKey (and a few self-service codes) into admin-facing
 * sections: Self-service, HR, Leave, Payroll, Admin.
 */

export type PermissionGroupKey =
  | "self-service"
  | "hr"
  | "leave"
  | "payroll"
  | "admin"
  | "other";

export const PERMISSION_GROUP_ORDER: PermissionGroupKey[] = [
  "self-service",
  "hr",
  "leave",
  "payroll",
  "admin",
  "other",
];

export const PERMISSION_GROUP_LABELS: Record<PermissionGroupKey, string> = {
  "self-service": "Self-service",
  hr: "HR",
  leave: "Leave",
  payroll: "Payroll",
  admin: "Admin",
  other: "Other",
};

const SELF_SERVICE_CODES = new Set([
  "notification.view_own",
  "people.profile.view_own",
  "leave.request",
]);

const MODULE_TO_GROUP: Record<string, PermissionGroupKey> = {
  notifications: "self-service",
  people: "hr",
  contracts: "hr",
  documents: "hr",
  reports: "hr",
  leave: "leave",
  payroll: "payroll",
  administration: "admin",
  identity: "admin",
  audit: "admin",
};

export function permissionGroupKey(input: {
  code: string;
  moduleKey: string;
}): PermissionGroupKey {
  if (SELF_SERVICE_CODES.has(input.code)) {
    return "self-service";
  }

  return MODULE_TO_GROUP[input.moduleKey] ?? "other";
}

export function permissionGroupLabel(key: PermissionGroupKey): string {
  return PERMISSION_GROUP_LABELS[key];
}
