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

export type MeProfileTabId =
  | "profile"
  | "leave"
  | "qualifications"
  | "documents"
  | "contracts"
  | "gratuity"
  | "payslips";

export type MeProfileTab = {
  id: MeProfileTabId;
  href: string;
  label: string;
  icon: LucideIcon;
  anyOf: readonly string[];
  requiresEmployeeFile?: boolean;
};

/**
 * Primary My Profile body tabs (header stays fixed; body swaps by route).
 */
export const meProfileTabs: readonly MeProfileTab[] = [
  {
    id: "profile",
    href: "/me",
    label: "Profile",
    icon: UserRound,
    anyOf: ["people.profile.view_own"],
  },
  {
    id: "leave",
    href: "/me/leave",
    label: "Leave",
    icon: CalendarDays,
    anyOf: ["leave.request"],
    requiresEmployeeFile: true,
  },
  {
    id: "qualifications",
    href: "/me/qualifications",
    label: "Qualifications",
    icon: ScrollText,
    anyOf: ["people.profile.view_own"],
    requiresEmployeeFile: true,
  },
  {
    id: "documents",
    href: "/me/documents",
    label: "Documents",
    icon: FolderOpen,
    anyOf: ["people.profile.view_own"],
    requiresEmployeeFile: true,
  },
  {
    id: "contracts",
    href: "/me/contracts",
    label: "Contracts",
    icon: FileSignature,
    anyOf: ["people.profile.view_own"],
  },
  {
    id: "gratuity",
    href: "/me/gratuity",
    label: "Gratuity",
    icon: Gift,
    anyOf: ["people.profile.view_own"],
  },
  {
    id: "payslips",
    href: "/me/payslips",
    label: "Payslips",
    icon: Wallet,
    anyOf: ["people.profile.view_own"],
  },
];

export function filterMeProfileTabs(
  tabs: readonly MeProfileTab[],
  options: {
    canAny: (...permissions: string[]) => boolean;
    workforceCategory?: string | null;
  },
): MeProfileTab[] {
  const hasEmployeeFile = requiresEmployeeFile(options.workforceCategory);

  return tabs.filter((tab) => {
    if (!options.canAny(...tab.anyOf)) {
      return false;
    }
    if (tab.requiresEmployeeFile && !hasEmployeeFile) {
      return false;
    }
    return true;
  });
}

export function isMeProfileTabActive(pathname: string, href: string): boolean {
  if (href === "/me") {
    return pathname === "/me";
  }
  if (href === "/me/payslips") {
    return (
      pathname === "/me/payslips" ||
      pathname.startsWith("/me/payslips/") ||
      pathname === "/me/payslip" ||
      pathname.startsWith("/me/payslip/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
