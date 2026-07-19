import type { VariantProps } from "class-variance-authority";

import { badgeVariants } from "@/components/ui/badge";
import type { Severity } from "@/src/types/severity";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Workforce Hub UI color conventions.
 *
 * Buttons
 * - default (primary): Save, Create, Submit — brand blue
 * - success: Approve, Confirm — positive outcome
 * - outline: Cancel, Back, Clear — secondary navigation
 * - destructive: Delete, Reject, Retire, Remove, Close contract — irreversible/negative
 * - warning: cautionary actions (rare on buttons)
 * - secondary / ghost / link: low-emphasis toolbar and icon actions
 *
 * Badges (semantic map — use helpers below; avoid ad-hoc colors)
 * - success: Active / Approved / Completed / Posted / Issued
 * - warning: Pending / Submitted / Draft / Expiring soon / On leave
 * - destructive: Rejected / Cancelled / Failed / Terminated / Overdue / Missing
 * - secondary: Inactive / Archived / Neutral meta (excluded, superseded, withdrawn)
 * - outline: Supplementary labels (category, kind, IDs) — not lifecycle status
 * - default: primary emphasis when no semantic match (rare)
 *
 * Typography — see `src/config/ui-typography.ts` and
 * `SectionHeading` / `EntityTitle` / `FieldLabel` components.
 *
 * Elevation — see `src/config/ui-elevation.ts`.
 */
export const UI_COLOR_CONVENTIONS = {
  button: {
    default: "Primary forward actions: Save, Create, Submit",
    success: "Positive confirmation: Approve, Confirm",
    outline: "Secondary navigation: Cancel, Back, Clear",
    destructive:
      "Irreversible or negative: Delete, Reject, Close, Withdraw approved leave",
    warning: "Cautionary actions requiring attention",
    secondary: "Low-emphasis actions in dense toolbars",
    ghost: "Tertiary/icon actions in headers and tables",
    link: "Inline text navigation",
  },
  badge: {
    success: "Active, approved, completed, posted, issued",
    warning: "Pending, submitted, draft, awaiting decision, on leave, expiring",
    destructive: "Rejected, cancelled, terminated, failed, overdue, missing",
    default: "Primary emphasis when no semantic match",
    secondary: "Inactive, archived, superseded, excluded, withdrawn",
    outline: "Supplementary metadata labels (not lifecycle status)",
  },
} as const;

export function leaveStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
    case "ACKNOWLEDGED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "destructive";
    case "PENDING_APPROVAL":
    case "AWAITING_ACKNOWLEDGEMENT":
    case "SUBMITTED":
    case "MANAGER_APPROVED":
    case "PENDING":
      return "warning";
    case "WITHDRAWN":
    case "SKIPPED":
      return "secondary";
    default:
      return "outline";
  }
}

export function employmentStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "ON_LEAVE":
      return "warning";
    case "TERMINATED":
    case "SUSPENDED":
      return "destructive";
    case "RETIRED":
    case "INACTIVE":
      return "secondary";
    default:
      return "outline";
  }
}

export function jobDescriptionStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "warning";
    case "RETIRED":
      return "secondary";
    default:
      return "outline";
  }
}

export function notificationSeverityBadgeVariant(
  severity: Severity,
): BadgeVariant {
  switch (severity) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
    case "critical":
      return "destructive";
    case "information":
    default:
      return "outline";
  }
}

/** Active / enabled flags across admin and structure records. */
export function activeStateBadgeVariant(isActive: boolean): BadgeVariant {
  return isActive ? "success" : "secondary";
}

/** ACTIVE / INACTIVE style domain statuses (org, BU, location, etc.). */
export function recordStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INACTIVE":
    case "ARCHIVED":
    case "RETIRED":
      return "secondary";
    case "SUSPENDED":
    case "TERMINATED":
      return "destructive";
    default:
      return "outline";
  }
}

/** Employment contract lifecycle (ACTIVE, DRAFT, SUPERSEDED, …). */
export function employmentContractStatusBadgeVariant(
  status: string,
): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
    case "EXPIRED":
      return "warning";
    case "TERMINATED":
    case "CANCELLED":
      return "destructive";
    case "SUPERSEDED":
      return "secondary";
    default:
      return "outline";
  }
}

/** Employee correspondence lifecycle. */
export function correspondenceStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ISSUED":
    case "ACKNOWLEDGED":
      return "success";
    case "DRAFT":
      return "warning";
    case "ARCHIVED":
    case "SUPERSEDED":
      return "secondary";
    default:
      return "outline";
  }
}

/** Correspondence employee-response thread status. */
export function correspondenceResponseStatusBadgeVariant(
  status: string,
): BadgeVariant {
  switch (status) {
    case "OPEN":
      return "warning";
    case "REVIEWED":
      return "secondary";
    default:
      return "outline";
  }
}

/** Employee file checklist item status. */
export function checklistItemStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "UPLOADED":
    case "SIGNED":
      return "success";
    case "PENDING":
      return "warning";
    case "NOT_APPLICABLE":
      return "secondary";
    case "MISSING":
      return "destructive";
    default:
      return "outline";
  }
}

/** Pay run DRAFT / APPROVED / POSTED / RECONCILED / CLOSED (and related). */
export function payRunStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "POSTED":
    case "RECONCILED":
    case "COMPLETED":
      return "success";
    case "CLOSED":
      return "secondary";
    case "APPROVED":
      return "outline";
    case "DRAFT":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

/** Payslip membership within a pay run. */
export function payslipStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "POSTED":
      return "success";
    case "DRAFT":
      return "warning";
    case "EXCLUDED":
      return "secondary";
    default:
      return "outline";
  }
}
