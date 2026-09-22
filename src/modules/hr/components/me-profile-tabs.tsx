"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { UI_MOTION } from "@/src/config/ui-typography";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import {
  filterMeProfileTabs,
  isMeProfileTabActive,
  meProfileTabs,
} from "@/src/modules/hr/lib/me-profile-tabs";

/**
 * Body tabs for My Profile — header stays fixed; these swap the page body.
 */
export function MeProfileTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { canAny, user } = useAuth();

  const tabs = filterMeProfileTabs(meProfileTabs, {
    canAny,
    workforceCategory: user?.employee?.workforceCategory,
  });

  if (tabs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="My profile sections"
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-border/70 pb-3",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = isMeProfileTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium",
              UI_MOTION.control,
              active ? UI_MOTION.tabActive : UI_MOTION.tabIdle,
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
