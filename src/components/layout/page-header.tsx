import type { ReactNode } from "react"

import { PageActions } from "@/src/components/layout/page-actions"

type PageHeaderProps = {
  title: string
  description?: string
  /**
   * Header actions. Prefer Cancel/Back first, primary Create/Save/New last.
   * Wrapped in PageActions automatically when provided.
   */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions != null ? <PageActions>{actions}</PageActions> : null}
    </div>
  )
}
