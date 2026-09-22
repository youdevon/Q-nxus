"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { resolveMeSectionIcon } from "@/src/modules/hr/lib/me-section-nav";

type MePageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /**
   * Lucide icon beside the title. Omit to resolve from Me section nav.
   * Pass `null` to hide the icon.
   * Do not pass Lucide components from Server Components — that breaks RSC serialization.
   */
  icon?: LucideIcon | null;
  /** Optional badge beside the title (e.g. position). */
  badge?: ReactNode;
  /**
   * Optional role/identity wash on the full header band (e.g. employee
   * leadership gradient).
   */
  titleAccentClassName?: string;
  /** Primary page actions. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Self-service (`/me`) page header. Section navigation lives in MeProfileTabs.
 */
export function MePageHeader({
  title,
  description,
  backHref,
  backLabel,
  icon,
  badge,
  titleAccentClassName,
  actions,
  className,
}: MePageHeaderProps) {
  const pathname = usePathname();
  const resolvedIcon =
    icon === null
      ? undefined
      : (icon ?? resolveMeSectionIcon(pathname) ?? undefined);

  return (
    <PageHeader
      title={title}
      description={description}
      backHref={backHref}
      backLabel={backLabel}
      icon={resolvedIcon}
      badge={badge}
      titleAccentClassName={titleAccentClassName}
      className={className}
      actions={
        actions ? <PageActionsEnd>{actions}</PageActionsEnd> : undefined
      }
    />
  );
}
