import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageActions } from "@/src/components/layout/page-actions";
import { UI_MOTION, UI_SURFACE, UI_TYPOGRAPHY } from "@/src/config/ui-typography";

export {
  FormPageActions,
  PageActions,
  PageActionsEnd,
  PageActionsStart,
} from "@/src/components/layout/page-actions";

type PageHeaderProps = {
  title: string;
  description?: string;
  /**
   * Parent navigation — always top-left above the title (chevron link).
   * Use on nested list → detail → edit flows. Prefer this over ArrowLeft
   * buttons in the actions slot or footer Back links.
   */
  backHref?: string;
  backLabel?: string;
  /** Lucide icon beside the title (same visual language as sidebar). */
  icon?: LucideIcon;
  /** Optional badge beside the title (e.g. position). */
  badge?: ReactNode;
  /**
   * Optional role/identity wash on the full header band (e.g. employee
   * leadership gradient). When set, the default title left-bar accent is
   * skipped so color lives on the band instead.
   */
  titleAccentClassName?: string;
  /**
   * Header actions. Forms: FormPageActions (Cancel left, Save right).
   * Detail pages: PageActionsEnd for Edit / primary only — back lives in backHref.
   */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  icon: Icon,
  badge,
  titleAccentClassName,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "group/page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        UI_SURFACE.pageHeaderBand,
        titleAccentClassName,
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0 space-y-1.5",
          !titleAccentClassName && UI_SURFACE.pageTitleAccent,
        )}
      >
        {backHref ? (
          <Link href={backHref} className={UI_MOTION.backLink}>
            <ChevronLeft className="size-3.5" aria-hidden />
            {backLabel}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          {Icon ? (
            <Icon
              className={cn("size-5 shrink-0", UI_MOTION.iconHover)}
              aria-hidden
            />
          ) : null}
          <h1 className={UI_TYPOGRAPHY.pageTitle}>{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className={UI_TYPOGRAPHY.pageDescription}>{description}</p>
        ) : null}
      </div>
      {actions != null ? <PageActions>{actions}</PageActions> : null}
    </div>
  );
}
