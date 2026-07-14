import type { LucideIcon } from "lucide-react"
import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react"

export type NavSectionId = "platform" | "modules" | "insights" | "system"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Future: gate by capability once auth lands */
  module?: "core" | "hr" | "payroll" | "admin"
}

export type NavSection = {
  id: NavSectionId
  label: string
  /** When false, the section label is omitted (e.g. lone platform home) */
  showLabel: boolean
  items: NavItem[]
}

/**
 * Sidebar navigation is declared once here so Core owns the chrome
 * while modules only contribute routes as they come online.
 */
export const navigationConfig: NavSection[] = [
  {
    id: "platform",
    label: "Platform",
    showLabel: false,
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        module: "core",
      },
    ],
  },
  {
    id: "modules",
    label: "Modules",
    showLabel: true,
    items: [
      {
        title: "People",
        href: "/people",
        icon: Users,
        module: "hr",
      },
      {
        title: "Payroll",
        href: "/payroll",
        icon: Wallet,
        module: "payroll",
      },
      {
        title: "Leave",
        href: "/leave",
        icon: CalendarDays,
        module: "hr",
      },
      {
        title: "Contracts",
        href: "/contracts",
        icon: Briefcase,
        module: "hr",
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        module: "hr",
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    showLabel: true,
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: ClipboardList,
        module: "core",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    showLabel: true,
    items: [
      {
        title: "Administration",
        href: "/administration",
        icon: Settings,
        module: "admin",
      },
    ],
  },
]
