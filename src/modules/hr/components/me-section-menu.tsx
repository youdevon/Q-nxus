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
import { cn } from "@/lib/utils";
import { UI_ELEVATION } from "@/src/config/ui-elevation";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import {
  filterMeSectionNavItems,
  isMeSectionActive,
  meSectionNavItems,
} from "@/src/modules/hr/lib/me-section-nav";

/**
 * My Profile section hamburger — sits in the page header action row.
 * Lists self-service tabs only (not People workspace destinations).
 *
 * Kept in its own module (not inlined into me-page-header) so Fast Refresh
 * never reuses a hook-free header fiber after this menu picks up hooks.
 */
export function MeSectionMenu() {
  const pathname = usePathname();
  const { canAny, user } = useAuth();
  const [open, setOpen] = useState(false);

  const visibleItems = filterMeSectionNavItems(meSectionNavItems, {
    canAny,
    workforceCategory: user?.employee?.workforceCategory,
  });

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="My profile sections"
            aria-expanded={open}
            className="size-8 shrink-0"
          />
        }
      >
        <Menu />
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
          <p className="text-sm font-semibold">My profile</p>
          <p className="text-xs text-muted-foreground">
            Choose a section to open
          </p>
        </div>

        <nav
          aria-label="My profile sections"
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          <ul className="grid gap-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isMeSectionActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors",
                      "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active && "bg-muted font-medium",
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm">
                        {item.title}
                        {active ? (
                          <Check className="size-3.5 text-muted-foreground" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
