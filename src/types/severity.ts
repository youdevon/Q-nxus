/** Shared severity vocabulary for toasts, page alerts, and in-app notifications. */
export type Severity =
  | "success"
  | "information"
  | "warning"
  | "error"
  | "critical";

export const SEVERITY_LABELS: Record<Severity, string> = {
  success: "Success",
  information: "Information",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};
