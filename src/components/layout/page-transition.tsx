"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { UI_MOTION } from "@/src/config/ui-typography";

/**
 * Soft enter animation on route change. Remounts with pathname so each
 * navigation gets a short fade/slide without affecting the sticky shell.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        UI_MOTION.pageEnter,
      )}
    >
      {children}
    </div>
  );
}
