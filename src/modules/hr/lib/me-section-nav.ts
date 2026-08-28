import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileSignature,
  FolderOpen,
  Gift,
  ScrollText,
  UserRound,
  Wallet,
} from "lucide-react";

import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";

export type MeSectionNavItem = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  /** Permission codes that grant this item. Empty = any authenticated self-service user. */
  anyOf: readonly string[];
  /** When true, only shown for full EMPLOYEE workforce category. */
  requiresEmployeeFile?: boolean;
};

/**
 * My Profile hamburger destinations — in-page section navigation for `/me/*`.
 * Not the People workspace menu.
 */
export const meSectionNavItems: readonly MeSectionNavItem[] = [
  {
    title: "Profile",
    href: "/me",
    description: "Personal and employment details",
    icon: UserRound,
    anyOf: ["people.profile.view_own"],
  },
  {
    title: "Documents",
    href: "/me/documents",
    description: "Letters, credentials, and training",
    icon: FolderOpen,
    anyOf: ["people.profile.view_own"],
    requiresEmployeeFile: true,
  },
  {
    title: "Qualifications",
    href: "/me/qualifications",
    description: "Qualifications on your employee file",
    icon: ScrollText,
    anyOf: ["people.profile.view_own"],
    requiresEmployeeFile: true,
  },
  {
    title: "Contracts",
    href: "/me/contracts",
    description: "Your employment contracts",
    icon: FileSignature,
    anyOf: ["people.profile.view_own"],
  },
  {
    title: "Gratuity",
    href: "/me/gratuity",
    description: "Contract-end gratuity estimates and payments",
    icon: Gift,
    anyOf: ["people.profile.view_own"],
  },
  {
    title: "Leave",
    href: "/me/leave",
    description: "Leave requests and balances",
    icon: CalendarDays,
    anyOf: ["leave.request"],
    requiresEmployeeFile: true,
  },
  {
    title: "Payslips",
    href: "/me/payslips",
    description: "Posted payslip history",
    icon: Wallet,
    anyOf: ["people.profile.view_own"],
  },
];

export function filterMeSectionNavItems(
  items: readonly MeSectionNavItem[],
  options: {
    canAny: (...permissions: string[]) => boolean;
    workforceCategory?: string | null;
  },
): MeSectionNavItem[] {
  const hasEmployeeFile = requiresEmployeeFile(options.workforceCategory);

  return items.filter((item) => {
    if (!options.canAny(...item.anyOf)) {
      return false;
    }

    if (item.requiresEmployeeFile && !hasEmployeeFile) {
      return false;
    }

    return true;
  });
}

export function isMeSectionActive(pathname: string, href: string): boolean {
  if (href === "/me") {
    return pathname === "/me";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Icon for the Me section that owns this path. */
export function resolveMeSectionIcon(pathname: string): LucideIcon | null {
  for (const item of meSectionNavItems) {
    if (isMeSectionActive(pathname, item.href)) {
      return item.icon;
    }
  }
  return null;
}
