import type { ModuleStatusItem } from "@/src/types/module-status"

export const dashboardMetrics = [
  { label: "Active employees", value: "1,248", hint: "Across all entities" },
  { label: "Open leave requests", value: "17", hint: "Awaiting approval" },
  { label: "Payroll readiness", value: "92%", hint: "July cycle" },
  { label: "Expiring contracts", value: "6", hint: "Next 30 days" },
] as const

export const upcomingEvents = [
  {
    title: "July payroll submission",
    when: "Tomorrow · 09:00",
    module: "Payroll",
  },
  {
    title: "Leadership onboarding cohort",
    when: "Thu · 14:00",
    module: "HR",
  },
  {
    title: "Policy acknowledgement deadline",
    when: "Fri · End of day",
    module: "Documents",
  },
] as const

export const recentActivity = [
  {
    title: "Employment contract issued",
    detail: "Priya Shah · Fixed-term",
    when: "12 min ago",
  },
  {
    title: "Leave approved",
    detail: "Sam Ortega · Annual leave",
    when: "1 hr ago",
  },
  {
    title: "Bank detail verified",
    detail: "Payroll exception cleared",
    when: "3 hr ago",
  },
  {
    title: "Role change recorded",
    detail: "Finance analyst → Senior analyst",
    when: "Yesterday",
  },
] as const

export const moduleStatuses: ModuleStatusItem[] = [
  {
    id: "core",
    name: "Core platform",
    module: "core",
    status: "operational",
    detail: "Identity, navigation, and shared services",
  },
  {
    id: "hr",
    name: "Human Resources",
    module: "hr",
    status: "operational",
    detail: "People, leave, contracts, and documents",
  },
  {
    id: "payroll",
    name: "Payroll",
    module: "payroll",
    status: "degraded",
    detail: "Bank validation checks running slowly",
  },
  {
    id: "admin",
    name: "Administration",
    module: "admin",
    status: "operational",
    detail: "Tenant settings and access control",
  },
]
