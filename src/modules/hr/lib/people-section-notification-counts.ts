/**
 * Maps in-app notification action URLs to People hamburger menu destinations.
 * Only People-section routes count; self-service `/me/*` links are excluded.
 */

export const PEOPLE_SECTION_MENU_HREFS = [
  "/people",
  "/people/documents",
  "/people/team-documents",
  "/people/leave",
  "/people/leave/holidays",
  "/people/leave/balances",
  "/people/leave/workflow",
  "/people/leave/types",
  "/people/structure",
] as const;

export type PeopleSectionMenuHref = (typeof PEOPLE_SECTION_MENU_HREFS)[number];

export type PeopleSectionNotificationCounts = Partial<
  Record<PeopleSectionMenuHref, number>
>;

const LEAVE_ADMIN_SEGMENTS = new Set([
  "holidays",
  "balances",
  "workflow",
  "types",
]);

function normalizePath(actionUrl: string): string {
  const withoutOrigin = actionUrl.startsWith("http://") || actionUrl.startsWith("https://")
    ? (() => {
        try {
          return new URL(actionUrl).pathname;
        } catch {
          return actionUrl;
        }
      })()
    : actionUrl;

  return withoutOrigin.split("?")[0]?.split("#")[0] ?? withoutOrigin;
}

function isLeaveRequestsPath(path: string): boolean {
  // Legacy bookmarks/notifications before the /people/leave move.
  if (path === "/leave" || path.startsWith("/leave/")) {
    return true;
  }

  if (path === "/people/leave") {
    return true;
  }

  if (!path.startsWith("/people/leave/")) {
    return false;
  }

  const firstSegment = path.slice("/people/leave/".length).split("/")[0] ?? "";
  return !LEAVE_ADMIN_SEGMENTS.has(firstSegment);
}

/**
 * Returns the People menu href that should show a badge for this notification,
 * or null when the link is outside the People section (e.g. `/me/documents`).
 */
export function mapActionUrlToPeopleSectionHref(
  actionUrl: string | null | undefined,
): PeopleSectionMenuHref | null {
  if (!actionUrl) {
    return null;
  }

  const path = normalizePath(actionUrl);

  if (!path.startsWith("/")) {
    return null;
  }

  if (isLeaveRequestsPath(path)) {
    return "/people/leave";
  }

  if (
    path === "/people/documents" ||
    path.startsWith("/people/documents/")
  ) {
    return "/people/documents";
  }

  if (
    path === "/people/team-documents" ||
    path.startsWith("/people/team-documents/")
  ) {
    return "/people/team-documents";
  }

  if (
    path === "/people/leave/holidays" ||
    path.startsWith("/people/leave/holidays/")
  ) {
    return "/people/leave/holidays";
  }

  if (
    path === "/people/leave/balances" ||
    path.startsWith("/people/leave/balances/")
  ) {
    return "/people/leave/balances";
  }

  if (
    path === "/people/leave/workflow" ||
    path.startsWith("/people/leave/workflow/")
  ) {
    return "/people/leave/workflow";
  }

  if (
    path === "/people/leave/types" ||
    path.startsWith("/people/leave/types/")
  ) {
    return "/people/leave/types";
  }

  if (
    path === "/people/structure" ||
    path.startsWith("/people/structure/")
  ) {
    return "/people/structure";
  }

  // Employee letter / file-update deep links → Documents section.
  if (/^\/people\/employees\/[^/]+\/documents(\/|$)/.test(path)) {
    return "/people/documents";
  }

  // Other employee profile deep links (e.g. contracts) → Employees.
  if (path === "/people" || path.startsWith("/people/employees")) {
    return "/people";
  }

  return null;
}

export function aggregatePeopleSectionCounts(
  actionUrls: Array<string | null | undefined> | null | undefined,
): PeopleSectionNotificationCounts {
  const counts: PeopleSectionNotificationCounts = {};
  const urls = Array.isArray(actionUrls) ? actionUrls : [];

  for (const actionUrl of urls) {
    const href = mapActionUrlToPeopleSectionHref(actionUrl);
    if (!href) {
      continue;
    }
    counts[href] = (counts[href] ?? 0) + 1;
  }

  return counts;
}

export function sumVisiblePeopleSectionCounts(
  counts: PeopleSectionNotificationCounts,
  visibleHrefs: readonly string[],
): number {
  let total = 0;
  for (const href of visibleHrefs) {
    total += counts[href as PeopleSectionMenuHref] ?? 0;
  }
  return total;
}

export function formatNotificationBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}
