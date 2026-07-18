"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { MeSectionMenu } from "@/src/modules/hr/components/me-section-menu";
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
  /** Primary page actions — rendered left of the section hamburger. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Self-service (`/me`) page header with in-page section hamburger.
 * Client boundary matches PeoplePageHeader so Fast Refresh never confuses
 * this wrapper with the hook-free PageHeader module.
 */
export function MePageHeader({
  title,
  description,
  backHref,
  backLabel,
  icon,
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
      className={className}
      actions={
        <PageActionsEnd>
          {actions}
          <MeSectionMenu />
        </PageActionsEnd>
      }
    />
  );
}
