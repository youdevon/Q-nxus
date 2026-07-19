import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FolderOpen,
  Network,
  Users,
} from "lucide-react";

import type { PeopleSectionMenuHref } from "@/src/modules/hr/lib/people-section-notification-counts";

export type PeopleSectionNavChild = {
  title: string;
  href: PeopleSectionMenuHref;
  description: string;
  anyOf: readonly string[];
};

export type PeopleSectionNavItem = {
  title: string;
  href: PeopleSectionMenuHref;
  description: string;
  icon: LucideIcon;
  anyOf: readonly string[];
  children?: readonly PeopleSectionNavChild[];
};

/**
 * People hamburger destinations — single source for menu icons and page headers.
 */
export const peopleSectionNavItems: readonly PeopleSectionNavItem[] = [
  {
    title: "Employees",
    href: "/people",
    description: "Employee directory and profiles",
    icon: Users,
    anyOf: ["people.directory.view", "people.manage"],
  },
  {
    title: "Documents",
    href: "/people/documents",
    description: "Organization correspondence and files",
    icon: FolderOpen,
    anyOf: ["people.manage"],
  },
  {
    title: "Team documents",
    href: "/people/team-documents",
    description: "Documents shared with your team",
    icon: FolderOpen,
    anyOf: ["people.directory.view", "people.manage", "people.profile.view_own"],
  },
  {
    title: "Leave",
    href: "/people/leave",
    description: "Review and manage leave requests",
    icon: ClipboardList,
    anyOf: ["leave.manage", "leave.approve", "people.directory.view"],
    children: [
      {
        title: "Balances",
        href: "/people/leave/balances",
        description: "Employee leave balance overview",
        anyOf: ["leave.manage", "people.manage"],
      },
      {
        title: "Workflow",
        href: "/people/leave/workflow",
        description: "Approval and acknowledgement settings",
        anyOf: ["leave.manage"],
      },
      {
        title: "Holidays",
        href: "/people/leave/holidays",
        description: "Organization holiday calendar",
        anyOf: ["leave.manage"],
      },
      {
        title: "Types",
        href: "/people/leave/types",
        description: "Leave categories and balance rules",
        anyOf: ["leave.manage"],
      },
    ],
  },
  {
    title: "Organization",
    href: "/people/structure",
    description: "Departments, positions, and chart",
    icon: Network,
    anyOf: ["people.directory.view", "people.manage"],
  },
];

const LEAVE_CHILD_SEGMENTS = new Set([
  "holidays",
  "balances",
  "workflow",
  "types",
]);

function isLeaveSectionPath(pathname: string): boolean {
  return pathname === "/people/leave" || pathname.startsWith("/people/leave/");
}

function isLeaveRequestsPath(pathname: string): boolean {
  if (pathname === "/people/leave") {
    return true;
  }
  if (!pathname.startsWith("/people/leave/")) {
    return false;
  }
  const firstSegment = pathname.slice("/people/leave/".length).split("/")[0];
  return !LEAVE_CHILD_SEGMENTS.has(firstSegment ?? "");
}

export function isPeopleSectionActive(
  pathname: string,
  href: PeopleSectionMenuHref,
  opts?: { treatLeaveParentAsSection?: boolean },
): boolean {
  if (href === "/people") {
    return pathname === "/people" || pathname.startsWith("/people/employees");
  }
  if (href === "/people/structure") {
    return pathname.startsWith("/people/structure");
  }
  if (href === "/people/documents") {
    return pathname.startsWith("/people/documents");
  }
  if (href === "/people/team-documents") {
    return pathname.startsWith("/people/team-documents");
  }
  if (href === "/people/leave") {
    if (opts?.treatLeaveParentAsSection) {
      return isLeaveSectionPath(pathname);
    }
    return isLeaveRequestsPath(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Icon for the People section that owns this path (Leave children → Leave). */
export function resolvePeopleSectionIcon(
  pathname: string,
): LucideIcon | null {
  for (const item of peopleSectionNavItems) {
    if (
      isPeopleSectionActive(pathname, item.href, {
        treatLeaveParentAsSection: true,
      })
    ) {
      return item.icon;
    }
  }
  return null;
}
