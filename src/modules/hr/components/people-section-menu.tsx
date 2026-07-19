"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import {
  isPeopleSectionActive,
  peopleSectionNavItems,
} from "@/src/modules/hr/lib/people-section-nav";
import {
  aggregatePeopleSectionCounts,
  formatNotificationBadgeCount,
  sumVisiblePeopleSectionCounts,
  type PeopleSectionMenuHref,
} from "@/src/modules/hr/lib/people-section-notification-counts";
import { useNotifications } from "@/src/modules/notifications/context/notification-provider";
import { cn } from "@/lib/utils";
import { UI_ELEVATION } from "@/src/config/ui-elevation";

function collectVisibleHrefs(
  visibleItems: Array<{
    href: string;
    children?: Array<{ href: string }>;
  }>,
): string[] {
  const hrefs: string[] = [];
  for (const item of visibleItems) {
    hrefs.push(item.href);
    for (const child of item.children ?? []) {
      hrefs.push(child.href);
    }
  }
  return hrefs;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white tabular-nums"
      aria-label={`${count} notifications`}
    >
      {formatNotificationBadgeCount(count)}
    </span>
  );
}

/**
 * People section hamburger — sits in the page header action row (right side).
 * Isolated from `people-nav.tsx` so Fast Refresh never reuses the old hook-free
 * `PeopleNav` fiber after this menu picks up extra hooks.
 */
export function PeopleSectionMenu() {
  const pathname = usePathname();
  const { canAny } = useAuth();
  const { unreadActionUrls } = useNotifications();
  const [open, setOpen] = useState(false);

  const visibleItems = peopleSectionNavItems
    .map((item) => {
      const visibleChildren = (item.children ?? []).filter((child) =>
        canAny(...child.anyOf),
      );
      const showParent = canAny(...item.anyOf);
      if (!showParent && visibleChildren.length === 0) {
        return null;
      }
      return {
        ...item,
        canOpenParent: showParent,
        children: visibleChildren,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const sectionCounts = aggregatePeopleSectionCounts(unreadActionUrls);
  const totalBadgeCount = sumVisiblePeopleSectionCounts(
    sectionCounts,
    collectVisibleHrefs(visibleItems),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // AppHeader is sticky top-0 h-14 z-20 — sit just below it.
        "fixed top-16 right-4 z-30 md:right-6 lg:right-8",
        "rounded-md bg-background/90 p-0.5 supports-backdrop-filter:bg-background/75 backdrop-blur",
        UI_ELEVATION.raised,
      )}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={
                totalBadgeCount > 0
                  ? `People section menu, ${totalBadgeCount} notifications`
                  : "People section menu"
              }
              aria-expanded={open}
              className="relative size-8 shrink-0"
            />
          }
        >
          <Menu />
          {totalBadgeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {formatNotificationBadgeCount(totalBadgeCount)}
            </span>
          ) : null}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          className={cn(
            "z-50 flex w-[min(22rem,calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] max-h-[min(70vh,32rem)] flex-col overflow-hidden p-0",
            UI_ELEVATION.raised,
          )}
        >
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">People</p>
            <p className="text-xs text-muted-foreground">
              Choose a section to open
            </p>
          </div>

          <nav
            aria-label="People sections"
            className="min-h-0 flex-1 overflow-y-auto p-2"
          >
            <ul className="grid gap-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const parentExactActive = isPeopleSectionActive(
                  pathname,
                  item.href,
                );
                const parentSectionActive =
                  item.children.length > 0
                    ? isPeopleSectionActive(pathname, item.href, {
                        treatLeaveParentAsSection: true,
                      })
                    : parentExactActive;
                const parentCount =
                  sectionCounts[item.href as PeopleSectionMenuHref] ?? 0;
                const parentClassName = cn(
                  "flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors",
                  "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  parentSectionActive && "bg-muted font-medium",
                );

                return (
                  <li key={item.href}>
                    {item.canOpenParent ? (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={parentExactActive ? "page" : undefined}
                        className={parentClassName}
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm">
                            {item.title}
                            {parentExactActive ? (
                              <Check className="size-3.5 text-muted-foreground" />
                            ) : null}
                            <CountBadge count={parentCount} />
                          </span>
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <div className={parentClassName}>
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </div>
                    )}

                    {item.children.length > 0 ? (
                      <ul className="mt-1 ml-4 grid gap-0.5 border-l border-border/70 pl-2">
                        {item.children.map((child) => {
                          const childActive = isPeopleSectionActive(
                            pathname,
                            child.href,
                          );
                          const childCount =
                            sectionCounts[
                              child.href as PeopleSectionMenuHref
                            ] ?? 0;

                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={() => setOpen(false)}
                                aria-current={childActive ? "page" : undefined}
                                className={cn(
                                  "flex items-start gap-2 rounded-md px-2.5 py-2 transition-colors",
                                  "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  childActive && "bg-muted font-medium",
                                )}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-sm">
                                    {child.title}
                                    {childActive ? (
                                      <Check className="size-3.5 text-muted-foreground" />
                                    ) : null}
                                    <CountBadge count={childCount} />
                                  </span>
                                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                    {child.description}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
