import type { AppNotification } from "@/src/types/notifications"

/** Placeholder feed used until the notifications module is wired to real data. */
export const mockNotifications: AppNotification[] = [
  {
    id: "n-1",
    title: "Leave request awaiting review",
    message: "Jordan Lee submitted annual leave for 18–22 Aug.",
    severity: "information",
    moduleSource: "hr",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    read: false,
    href: "/leave",
  },
  {
    id: "n-2",
    title: "Payroll cycle locked",
    message: "July payroll run is locked for final processing.",
    severity: "success",
    moduleSource: "payroll",
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    read: false,
    href: "/payroll",
  },
  {
    id: "n-3",
    title: "Document retention reminder",
    message: "3 contracts reach retention review next week.",
    severity: "warning",
    moduleSource: "hr",
    createdAt: new Date(Date.now() - 8 * 3_600_000).toISOString(),
    read: true,
    href: "/documents",
  },
  {
    id: "n-4",
    title: "Audit export delayed",
    message: "Nightly audit package exceeded the expected window.",
    severity: "error",
    moduleSource: "audit",
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    read: false,
  },
  {
    id: "n-5",
    title: "Identity provider degraded",
    message: "SSO latency is elevated. Sign-in may take longer.",
    severity: "critical",
    moduleSource: "admin",
    createdAt: new Date(Date.now() - 40 * 3_600_000).toISOString(),
    read: true,
    href: "/administration",
  },
]
