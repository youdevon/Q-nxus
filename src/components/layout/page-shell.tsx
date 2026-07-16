import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  /** `md` for detail/forms (max-w-5xl), `lg` for directories/workspaces (max-w-6xl), `xl` for wide monitoring. */
  size?: "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
} as const;

export function PageShell({
  children,
  size = "md",
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:gap-8 md:p-6 lg:p-8",
        sizeClass[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
