const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

/**
 * Prefer a public/client IPv4 address from proxy headers or stored values.
 * Strips IPv6-mapped IPv4 (`::ffff:a.b.c.d`) and skips pure IPv6.
 */
export function normalizeClientIp(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  for (const part of raw.split(",")) {
    let candidate = part.trim();

    if (!candidate) {
      continue;
    }

    if (candidate.startsWith("[") && candidate.endsWith("]")) {
      candidate = candidate.slice(1, -1);
    }

    const mappedPrefix = "::ffff:";
    if (candidate.toLowerCase().startsWith(mappedPrefix)) {
      candidate = candidate.slice(mappedPrefix.length);
    }

    if (IPV4_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Prefer IPv4 for display. Pure IPv6 (including ::1) is omitted.
 * IPv6-mapped IPv4 (`::ffff:a.b.c.d`) is shown as IPv4.
 */
export function formatAuditIpAddress(
  ipAddress: string | null | undefined,
): string | null {
  return normalizeClientIp(ipAddress);
}

export function formatAuditLabel(value: string): string {
  return value
    .replaceAll(/[_-]+/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Prisma CUID / similar opaque record ids — not for primary UI labels. */
export function looksLikeOpaqueId(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value.trim());
}

/**
 * Replace opaque entity ids in free-text descriptions with a resolved label.
 */
export function humanizeAuditDescription(
  description: string | null | undefined,
  options: {
    entityId?: string | null;
    entityLabel?: string | null;
    referenceLabels?: ReadonlyMap<string, string> | Record<string, string>;
  } = {},
): string | null {
  const text = description?.trim();
  if (!text) {
    return null;
  }

  let result = text;
  const labelFor = (id: string): string | undefined => {
    if (options.entityId === id && options.entityLabel) {
      return options.entityLabel;
    }
    return resolveReferenceLabel(id, options.referenceLabels);
  };

  if (options.entityId && options.entityLabel && result.includes(options.entityId)) {
    result = result.replaceAll(options.entityId, options.entityLabel);
  }

  result = result.replace(/\bc[a-z0-9]{20,}\b/gi, (match) => {
    return labelFor(match) ?? match;
  });

  // Drop any remaining unresolved opaque ids rather than showing them.
  result = result
    .replace(/\bc[a-z0-9]{20,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

  return result || null;
}

const MODULE_LABELS: Record<string, string> = {
  core: "Core",
  hr: "HR",
  payroll: "Payroll",
  admin: "Admin",
  administration: "Administration",
  identity: "Identity",
  auth: "Auth",
  notifications: "Notifications",
  audit: "Audit",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  ASSIGN_ROLE: "Assigned role",
  REVOKE_ROLE: "Revoked role",
  RESET: "Reset",
  APPROVE: "Approved",
  REJECT: "Rejected",
  SUBMIT: "Submitted",
  REVIEW: "Reviewed",
  ACKNOWLEDGE: "Acknowledged",
  ISSUE: "Issued",
  DOWNLOAD: "Downloaded",
  VIEW: "Viewed",
  COMPLETE: "Completed",
  CANCEL: "Cancelled",
  CLOSE: "Closed",
  LOGIN: "Signed in",
  LOGIN_FAILED: "Sign-in failed",
  LOGOUT: "Signed out",
};

const ENTITY_LABELS: Record<string, string> = {
  Employee: "Employee",
  EmploymentContract: "Employment contract",
  EmployeeAssignment: "Employee assignment",
  LeaveRequest: "Leave request",
  LeaveType: "Leave type",
  EmployeeCorrespondence: "Employee correspondence",
  EmployeeCorrespondenceAttachment: "Correspondence attachment",
  EmployeeCorrespondenceResponse: "Employee letter response",
  CorrespondenceTemplate: "Correspondence template",
  EmployeeCredential: "Employee credential",
  EmployeeTrainingRecord: "Training record",
  EmployeeQualificationDocument: "Employee qualification",
  EmployeeQualificationEntry: "Qualification subject",
  EmployeeFileChecklistItem: "Employee file checklist item",
  PerformanceAppraisal: "Performance appraisal",
  Position: "Position",
  Department: "Department",
  Organization: "Organization",
  BusinessUnit: "Business unit",
  Location: "Location",
  User: "User",
  UserRole: "User role",
  Role: "Role",
  NumberingSequence: "Numbering sequence",
  AllowanceCategory: "Allowance category",
  FeatureFlag: "Feature flag",
  ApplicationSetting: "Application setting",
  DomainSetting: "Domain setting",
  JobDescription: "Job description",
  PositionJobDescription: "Job description",
  DemoData: "Demo data",
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  middleName: "Middle name",
  email: "Email",
  phone: "Phone",
  status: "Status",
  isActive: "Active",
  employmentType: "Employment type",
  employmentStatus: "Employment status",
  hireDate: "Hire date",
  terminationDate: "Termination date",
  employeeNumber: "Employee number",
  departmentId: "Department",
  positionId: "Position",
  businessUnitId: "Business unit",
  locationId: "Location",
  roleId: "Role",
  roleCode: "Role code",
  userId: "User",
  code: "Code",
  name: "Name",
  shortName: "Short name",
  legalName: "Legal name",
  website: "Website",
  description: "Description",
  defaultTimeZone: "Default time zone",
  defaultCurrency: "Default currency",
  defaultLanguage: "Default language",
  dateFormat: "Date format",
  firstDayOfWeek: "First day of week",
  version: "Version",
  effectiveFrom: "Effective from",
  effectiveUntil: "Effective until",
  reason: "Reason",
  startDate: "Start date",
  endDate: "End date",
  baseSalary: "Base salary",
  currency: "Currency",
  jobTitle: "Position",
  sequenceCode: "Sequence code",
  prefix: "Prefix",
  nextNumber: "Next number",
  padding: "Padding",
  resetFrequency: "Reset frequency",
  reportingToPositionId: "Reports to",
  systemRoleCode: "System role",
};

export function formatAuditModule(moduleKey: string): string {
  return MODULE_LABELS[moduleKey] ?? formatAuditLabel(moduleKey);
}

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? formatAuditLabel(action);
}

export function formatAuditEntityType(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? formatAuditLabel(entityType);
}

export function formatAuditFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? formatAuditLabel(field);
}

export function formatAuditHeadline(
  action: string,
  entityType: string,
): string {
  const actionLabel = formatAuditAction(action);
  const entityLabel = formatAuditEntityType(entityType).toLowerCase();

  if (
    actionLabel.endsWith("ed") ||
    actionLabel.endsWith("d") ||
    actionLabel.includes("")
  ) {
    return `${actionLabel} ${entityLabel}`;
  }

  return `${actionLabel} ${entityLabel}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type FormatAuditDisplayOptions = {
  /** Resolved labels keyed by opaque entity id. */
  referenceLabels?: ReadonlyMap<string, string> | Record<string, string>;
};

function resolveReferenceLabel(
  id: string,
  labels?: ReadonlyMap<string, string> | Record<string, string>,
): string | undefined {
  if (!labels) {
    return undefined;
  }
  if (labels instanceof Map) {
    return labels.get(id);
  }
  return Object.hasOwn(labels, id)
    ? (labels as Record<string, string>)[id]
    : undefined;
}

export function formatAuditDisplayValue(
  value: unknown,
  options: FormatAuditDisplayOptions = {},
): string {
  if (value === null || typeof value === "undefined") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }

  if (typeof value === "string") {
    if (!value) {
      return "—";
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return formatAuditDateTime(date);
      }
    }

    if (/^[A-Z][A-Z0-9_]*$/.test(value) && value.includes("_")) {
      return formatAuditLabel(value);
    }

    if (looksLikeOpaqueId(value)) {
      return resolveReferenceLabel(value, options.referenceLabels) ?? "—";
    }

    return value;
  }

  if (value instanceof Date) {
    return formatAuditDateTime(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "None";
    }

    return value
      .map((item) => formatAuditDisplayValue(item, options))
      .join(", ");
  }

  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

export function formatAuditDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Friendly device / browser label derived from a user-agent string.
 */
export function formatDeviceLabelFromUserAgent(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) {
    return null;
  }

  const ua = userAgent;

  let os = "Unknown OS";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";

  return `${os} · ${browser}`;
}

export function formatWorkstationLabel(options: {
  clientHostName?: string | null;
  userAgent?: string | null;
}): string | null {
  const host = options.clientHostName?.trim();
  const device = formatDeviceLabelFromUserAgent(options.userAgent);

  if (host && device) {
    return `${host} (${device})`;
  }

  return host || device || null;
}

export type AuditChangeRow = {
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

export function buildAuditChangeRows(
  oldValues: unknown,
  newValues: unknown,
  options: FormatAuditDisplayOptions = {},
): AuditChangeRow[] {
  const oldObject = isPlainObject(oldValues) ? oldValues : {};
  const newObject = isPlainObject(newValues) ? newValues : {};
  const keys = Array.from(
    new Set([...Object.keys(oldObject), ...Object.keys(newObject)]),
  ).sort((a, b) => a.localeCompare(b));

  return keys.map((field) => {
    const beforeRaw = oldObject[field];
    const afterRaw = newObject[field];
    const before = formatAuditDisplayValue(beforeRaw, options);
    const after = formatAuditDisplayValue(afterRaw, options);

    return {
      field,
      label: formatAuditFieldLabel(field),
      before,
      after,
      changed: JSON.stringify(beforeRaw) !== JSON.stringify(afterRaw),
    };
  });
}
