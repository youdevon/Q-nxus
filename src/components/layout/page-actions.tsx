import type { ReactNode } from "react"

type PageActionsProps = {
  children: ReactNode
}

/**
 * Standard PageHeader action group.
 * Place Cancel/Back first (left), primary Create/Save/New last (right).
 */
export function PageActions({ children }: PageActionsProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  )
}
