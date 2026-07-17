/**
 * Roles selectable on a Position as systemRoleCode.
 * Holders receive the role in addition to employee self-service.
 */
export const POSITION_SYSTEM_ROLE_OPTIONS = [
  { value: "LEAVE_APPROVER", label: "Leave Approver" },
  { value: "HR_CLERK", label: "HR Clerk" },
  { value: "HR_LEAVE_OFFICER", label: "HR Leave Officer" },
  { value: "HR_ADMINISTRATOR", label: "HR Administrator" },
  { value: "PAYROLL_CLERK", label: "Payroll Clerk" },
  { value: "PAYROLL_OFFICER", label: "Payroll Officer" },
  {
    value: "HR_PAYROLL_ADMINISTRATOR",
    label: "HR & Payroll Administrator",
  },
  { value: "SYSTEM_ADMINISTRATOR", label: "System Administrator" },
] as const

export type PositionSystemRoleCode =
  (typeof POSITION_SYSTEM_ROLE_OPTIONS)[number]["value"]
