"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { navigationConfig } from "@/src/config/navigation.config";
import { UI_SURFACE, UI_TYPOGRAPHY } from "@/src/config/ui-typography";
import { PeopleSectionMenu } from "@/src/modules/hr/components/people-section-menu";
import { resolvePeopleSectionIcon } from "@/src/modules/hr/lib/people-section-nav";

type PeoplePageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /**
   * Lucide icon beside the title. Omit to resolve from People/sidebar nav.
   * Pass `null` to hide the icon.
   */
  icon?: LucideIcon | null;
  /** Primary page actions (e.g. New employee). Rendered left of the hamburger. */
  actions?: ReactNode;
  className?: string;
};

function resolveSidebarNavIcon(pathname: string): LucideIcon | null {
  for (const section of navigationConfig) {
    for (const item of section.items) {
      if (item.href === "/") {
        if (pathname === "/") {
          return item.icon;
        }
        continue;
      }

      const prefix = item.matchPrefix ?? item.href;
      if (
        pathname === item.href ||
        pathname === prefix ||
        pathname.startsWith(`${prefix}/`)
      ) {
        return item.icon;
      }
    }
  }
  return null;
}

/**
 * People/Leave page header. Title on the left; primary actions on the right.
 * The section hamburger is fixed (via PeopleSectionMenu) below the app header
 * so it stays reachable while scrolling on every People page.
 */
export function PeoplePageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  icon,
  actions,
  className,
}: PeoplePageHeaderProps) {
  const pathname = usePathname();
  const Icon =
    icon === null
      ? null
      : (icon ??
        resolvePeopleSectionIcon(pathname) ??
        resolveSidebarNavIcon(pathname));

  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        // Keep title/actions clear of the fixed top-right hamburger.
        "pr-12",
        UI_SURFACE.pageHeaderBand,
        className,
      )}
    >
      <div className={cn("min-w-0 space-y-1.5", UI_SURFACE.pageTitleAccent)}>
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {backLabel}
          </Link>
        ) : null}
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <Icon
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <h1 className={UI_TYPOGRAPHY.pageTitle}>{title}</h1>
        </div>
        {description ? (
          <p className={UI_TYPOGRAPHY.pageDescription}>{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}

      <PeopleSectionMenu />
    </div>
  );
}
