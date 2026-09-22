import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { UI_MOTION, UI_SURFACE } from "@/src/config/ui-typography";

type StickyEntityTab = {
  href: string;
  label: string;
  current?: boolean;
};

type StickyEntityContextProps = {
  /** Primary identity — run number, employee name, etc. */
  title: string;
  /** Secondary line — period, employee #, status text. */
  meta?: ReactNode;
  badge?: ReactNode;
  /** Sibling view links (Overview / Paysheet / Payslips). */
  tabs?: StickyEntityTab[];
  actions?: ReactNode;
  className?: string;
};

/**
 * Slim sticky strip under the app header so long detail pages keep entity
 * context and sibling-view navigation while scrolling.
 */
export function StickyEntityContext({
  title,
  meta,
  badge,
  tabs,
  actions,
  className,
}: StickyEntityContextProps) {
  return (
    <div
      data-slot="sticky-entity-context"
      className={cn(UI_SURFACE.stickyEntityContext, className)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
              {title}
            </p>
            {badge}
          </div>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>

        {tabs && tabs.length > 0 ? (
          <nav
            aria-label="Section"
            className="flex flex-wrap items-center gap-1"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.current ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  UI_MOTION.control,
                  tab.current ? UI_MOTION.tabActive : UI_MOTION.tabIdle,
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
