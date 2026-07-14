/** Lifecycle states modules can report into the platform status surface. */
export type ModuleStatus = "operational" | "degraded" | "unavailable"

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  unavailable: "Temporarily unavailable",
}

export type ModuleStatusItem = {
  id: string
  name: string
  module: "core" | "hr" | "payroll" | "admin" | "notifications" | "audit"
  status: ModuleStatus
  detail?: string
}
