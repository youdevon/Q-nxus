import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type PageActionsProps = {
  children: ReactNode;
};

/**
 * Secondary/cancel actions — place on the left in PageHeader.
 */
export function PageActionsStart({ children }: PageActionsProps) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * Primary/forward actions — place on the right in PageHeader.
 */
export function PageActionsEnd({ children }: PageActionsProps) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
  );
}

/**
 * Standard PageHeader action group.
 * Use PageActionsStart for Cancel and PageActionsEnd for Create/Save/Submit.
 * Wraps cleanly on narrow viewports.
 */
export function PageActions({ children }: PageActionsProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {children}
    </div>
  );
}

type FormPageActionsProps = {
  /** Destination when abandoning the form (same as PageHeader backHref in most flows). */
  cancelHref: string;
  cancelLabel?: string;
  /** Primary submit / forward controls — rendered on the right. */
  children: ReactNode;
};

/**
 * Form chrome: Cancel on the left, primary actions on the right.
 * Pair with PageHeader `backHref` for parent navigation (chevron above the title).
 * Do not also put a separate Back button in the action row.
 */
export function FormPageActions({
  cancelHref,
  cancelLabel = "Cancel",
  children,
}: FormPageActionsProps) {
  return (
    <>
      <PageActionsStart>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={cancelHref} />}
        >
          {cancelLabel}
        </Button>
      </PageActionsStart>
      <PageActionsEnd>{children}</PageActionsEnd>
    </>
  );
}
