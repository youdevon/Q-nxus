import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { UI_TYPOGRAPHY } from "@/src/config/ui-typography";

type SectionHeadingProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "h2" | "h3" | "p";
};

/** In-page section title — uppercase, compact, consistent across modules. */
export function SectionHeading({
  children,
  className,
  id,
  as: Comp = "h2",
}: SectionHeadingProps) {
  return (
    <Comp id={id} className={cn(UI_TYPOGRAPHY.sectionHeading, className)}>
      {children}
    </Comp>
  );
}

type EntityTitleProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

/** Primary entity name under PageHeader on detail pages. */
export function EntityTitle({
  children,
  className,
  as: Comp = "h2",
}: EntityTitleProps) {
  return (
    <Comp className={cn(UI_TYPOGRAPHY.entityTitle, className)}>{children}</Comp>
  );
}
