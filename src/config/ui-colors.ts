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
 * Badges
 * - success: approved, active, completed
 * - warning: pending, submitted, on leave
 * - destructive: rejected, cancelled, terminated
 * - default: primary emphasis when no semantic match
 * - secondary / outline: neutral or supplementary metadata
 *
 * Typography — see `src/config/ui-typography.ts` and
 * `SectionHeading` / `EntityTitle` / `FieldLabel` components.
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
    success: "Approved, active, completed",
    warning: "Pending, submitted, awaiting decision, on leave",
    destructive: "Rejected, cancelled, terminated, error",
    default: "Primary emphasis when no semantic match",
    secondary: "Neutral or inactive statuses",
    outline: "Supplementary metadata labels",
  },
} as const;

export function leaveStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "destructive";
    case "PENDING_APPROVAL":
    case "SUBMITTED":
    case "MANAGER_APPROVED":
      return "warning";
    case "WITHDRAWN":
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
