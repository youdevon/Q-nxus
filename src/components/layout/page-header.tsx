import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageActions } from "@/src/components/layout/page-actions";
import { UI_SURFACE, UI_TYPOGRAPHY } from "@/src/config/ui-typography";

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
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        `flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${UI_SURFACE.pageHeaderBand}`,
        className,
      )}
    >
      <div className={`min-w-0 space-y-1.5 ${UI_SURFACE.pageTitleAccent}`}>
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
      {actions != null ? <PageActions>{actions}</PageActions> : null}
    </div>
  );
}
