import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  Bell,
  UserRound,
} from "lucide-react";

export type NavSectionId = "platform" | "modules" | "insights" | "system";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  module?: "core" | "hr" | "payroll" | "admin";
  /** Permission codes that grant access to this item. Empty = authenticated only. */
  anyOf?: string[];
  /**
   * Path prefix used for sidebar active state when `href` points at a
   * nested default route (e.g. Administration → /administration/organization).
   */
  matchPrefix?: string;
};

export type NavSection = {
  id: NavSectionId;
  label: string;
  showLabel: boolean;
  items: NavItem[];
};

/**
 * Sidebar navigation is declared once here so Core owns the chrome
 * while modules only contribute routes as they come online.
 *
 * Leave and Documents live under People (hamburger), not as sidebar tabs.
 */
export const navigationConfig: NavSection[] = [
  {
    id: "platform",
    label: "Platform",
    showLabel: false,
    items: [
      {
        title: "Notifications",
        href: "/notifications",
        icon: Bell,
        anyOf: ["notification.view_own"],
      },
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        module: "core",
      },
      {
        title: "My Profile",
        href: "/me",
        icon: UserRound,
        anyOf: ["people.profile.view_own"],
      },
    ],
  },
  {
    id: "modules",
    label: "Modules",
    showLabel: true,
    items: [
      {
        title: "Employees",
        href: "/people",
        icon: Users,
        module: "hr",
        anyOf: ["people.directory.view", "people.manage"],
      },
      {
        title: "Payroll",
        href: "/payroll",
        icon: Wallet,
        module: "payroll",
        anyOf: ["payroll.view", "payroll.setup", "payroll.manage"],
      },
      {
        title: "Contracts",
        href: "/contracts",
        icon: Briefcase,
        module: "hr",
        anyOf: ["contracts.view", "contracts.manage"],
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
        anyOf: ["reports.view"],
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
        href: "/administration/organization",
        matchPrefix: "/administration",
        icon: Settings,
        module: "admin",
        anyOf: ["administration.view"],
      },
    ],
  },
];

export function filterNavigationForCapabilities(
  canAny: (...permissions: string[]) => boolean,
): NavSection[] {
  return navigationConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.anyOf || item.anyOf.length === 0) {
          return true;
        }

        return canAny(...item.anyOf);
      }),
    }))
    .filter((section) => section.items.length > 0);
}
