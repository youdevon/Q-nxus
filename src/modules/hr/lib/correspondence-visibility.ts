import type {
  CorrespondenceCategory,
  CorrespondenceStatus,
} from "@/generated/prisma/client";

export const CORRESPONDENCE_CATEGORIES = [
  "RECOMMENDATION",
  "DISCIPLINARY",
  "WARNING",
  "INSTRUCTION",
  "COMMENDATION",
  "PERFORMANCE",
  "POLICY",
  "OFFER_LETTER",
  "EXIT_CLEARANCE",
  "MEDICAL",
  "IDENTIFICATION",
  "GENERAL",
  "OTHER",
] as const satisfies readonly CorrespondenceCategory[];

export const CORRESPONDENCE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "ACKNOWLEDGED",
  "ARCHIVED",
  "SUPERSEDED",
] as const satisfies readonly CorrespondenceStatus[];

/** Categories that typically require employee acknowledgement when issued. */
export const ACKNOWLEDGEMENT_CATEGORIES = new Set<CorrespondenceCategory>([
  "DISCIPLINARY",
  "WARNING",
  "INSTRUCTION",
  "POLICY",
]);

/**
 * Categories that are always HR-only: never employee- or manager-visible,
 * and attachment downloads are audit-logged.
 */
export const RESTRICTED_CATEGORIES = new Set<CorrespondenceCategory>([
  "MEDICAL",
  "IDENTIFICATION",
]);

/** Days after issue before a pending acknowledgement counts as overdue. */
export const ACKNOWLEDGEMENT_OVERDUE_DAYS = 7;

/** Days ahead that credential / training expiry warnings surface. */
export const EXPIRY_WARNING_DAYS = 30;

/** Default retention period (years from issue date) per category. */
export const CATEGORY_RETENTION_YEARS: Partial<
  Record<CorrespondenceCategory, number>
> = {
  DISCIPLINARY: 2,
  WARNING: 2,
};

export type CorrespondenceVisibilityInput = {
  status: CorrespondenceStatus;
  employeeVisible: boolean;
};

/**
 * Employees may see a record only when it is issued (or acknowledged)
 * and explicitly marked employee-visible. Drafts, superseded versions,
 * and archived HR-confidential items are never exposed on self-service.
 */
export function isEmployeeVisibleCorrespondence(
  record: CorrespondenceVisibilityInput,
): boolean {
  if (!record.employeeVisible) {
    return false;
  }

  return record.status === "ISSUED" || record.status === "ACKNOWLEDGED";
}

/**
 * The reporting officer (supervisor) may read issued items explicitly
 * shared with managers. Same lifecycle gate as employee visibility.
 */
export function isManagerVisibleCorrespondence(record: {
  status: CorrespondenceStatus;
  managerVisible: boolean;
}): boolean {
  if (!record.managerVisible) {
    return false;
  }

  return record.status === "ISSUED" || record.status === "ACKNOWLEDGED";
}

export function canEmployeeAcknowledgeCorrespondence(record: {
  status: CorrespondenceStatus;
  employeeVisible: boolean;
  requiresAcknowledgement: boolean;
}): boolean {
  return (
    isEmployeeVisibleCorrespondence(record) &&
    record.requiresAcknowledgement &&
    record.status === "ISSUED"
  );
}

/** HR may silently edit only while the letter remains a draft. */
export function canHrEditCorrespondence(status: CorrespondenceStatus): boolean {
  return status === "DRAFT";
}

/** Issued/acknowledged letters may be archived; drafts may be discarded via archive too. */
export function canHrArchiveCorrespondence(
  status: CorrespondenceStatus,
): boolean {
  return status === "DRAFT" || status === "ISSUED" || status === "ACKNOWLEDGED";
}

export function canHrIssueCorrespondence(
  status: CorrespondenceStatus,
): boolean {
  return status === "DRAFT";
}

/**
 * Issued content must never be edited silently. A supersede creates a new
 * linked draft; the old letter is marked SUPERSEDED when the replacement
 * is issued.
 */
export function canHrSupersedeCorrespondence(
  status: CorrespondenceStatus,
): boolean {
  return status === "ISSUED" || status === "ACKNOWLEDGED";
}

export function defaultRequiresAcknowledgement(
  category: CorrespondenceCategory,
): boolean {
  return ACKNOWLEDGEMENT_CATEGORIES.has(category);
}

export function isRestrictedCategory(
  category: CorrespondenceCategory,
): boolean {
  return RESTRICTED_CATEGORIES.has(category);
}

/**
 * Default retention date derived from the category, anchored on the issue
 * date. Returns null for categories without a retention default.
 */
export function defaultRetentionUntil(
  category: CorrespondenceCategory,
  issueDate: Date,
): Date | null {
  const years = CATEGORY_RETENTION_YEARS[category];

  if (!years) {
    return null;
  }

  const retention = new Date(issueDate);
  retention.setUTCFullYear(retention.getUTCFullYear() + years);
  return retention;
}

/**
 * An issued letter that still requires acknowledgement is overdue once
 * {@link ACKNOWLEDGEMENT_OVERDUE_DAYS} have passed since the issue date.
 */
export function isAcknowledgementOverdue(
  record: {
    status: CorrespondenceStatus;
    requiresAcknowledgement: boolean;
    issueDate: Date | null;
  },
  asOf: Date = new Date(),
): boolean {
  if (
    record.status !== "ISSUED" ||
    !record.requiresAcknowledgement ||
    !record.issueDate
  ) {
    return false;
  }

  const deadline = new Date(record.issueDate);
  deadline.setUTCDate(deadline.getUTCDate() + ACKNOWLEDGEMENT_OVERDUE_DAYS);
  return asOf.getTime() > deadline.getTime();
}

export type ExpiryStatus = "EXPIRED" | "EXPIRING" | "OK";

/** Expiry warning window used for credentials and training records. */
export function getExpiryStatus(
  expiryDate: Date | null,
  asOf: Date = new Date(),
  warningDays: number = EXPIRY_WARNING_DAYS,
): ExpiryStatus {
  if (!expiryDate) {
    return "OK";
  }

  const asOfDay = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  const expiryDay = new Date(
    Date.UTC(
      expiryDate.getUTCFullYear(),
      expiryDate.getUTCMonth(),
      expiryDate.getUTCDate(),
    ),
  );

  if (expiryDay.getTime() < asOfDay.getTime()) {
    return "EXPIRED";
  }

  const warningEdge = new Date(asOfDay);
  warningEdge.setUTCDate(warningEdge.getUTCDate() + warningDays);
  return expiryDay.getTime() <= warningEdge.getTime() ? "EXPIRING" : "OK";
}

/**
 * Days until expiry (negative when already expired). Null when no date.
 */
export function daysUntilExpiry(
  expiryDate: Date | null,
  asOf: Date = new Date(),
): number | null {
  if (!expiryDate) {
    return null;
  }

  const asOfDay = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  const expiryDay = new Date(
    Date.UTC(
      expiryDate.getUTCFullYear(),
      expiryDate.getUTCMonth(),
      expiryDate.getUTCDate(),
    ),
  );

  return Math.round(
    (expiryDay.getTime() - asOfDay.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export const EXPIRY_DASHBOARD_WINDOWS = [30, 60, 90] as const;

export type ExpiryDashboardWindow =
  (typeof EXPIRY_DASHBOARD_WINDOWS)[number];

export function isExpiryDashboardWindow(
  value: number,
): value is ExpiryDashboardWindow {
  return (EXPIRY_DASHBOARD_WINDOWS as readonly number[]).includes(value);
}

export function isCorrespondenceCategory(
  value: string,
): value is CorrespondenceCategory {
  return (CORRESPONDENCE_CATEGORIES as readonly string[]).includes(value);
}

export function isCorrespondenceStatus(
  value: string,
): value is CorrespondenceStatus {
  return (CORRESPONDENCE_STATUSES as readonly string[]).includes(value);
}
