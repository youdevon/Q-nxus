import type { Severity } from "@/src/types/severity"

export type NotificationModuleSource =
  | "core"
  | "hr"
  | "payroll"
  | "admin"
  | "notifications"
  | "audit"

export type AppNotification = {
  id: string
  title: string
  message: string
  severity: Severity
  moduleSource: NotificationModuleSource
  createdAt: string
  read: boolean
  /** Optional deep link to a related record once modules ship */
  href?: string
}
