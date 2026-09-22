import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { UI_SURFACE } from "@/src/config/ui-typography"

type PageSectionProps = {
  children: ReactNode
  className?: string
  /** Optional accessible label for landmark sections. */
  "aria-label"?: string
  "aria-labelledby"?: string
}

/**
 * Standard in-page section: title row + content with consistent gap.
 * Prefer this over wrapping content in border-y frames.
 */
export function PageSection({
  children,
  className,
  ...aria
}: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)} {...aria}>
      {children}
    </section>
  )
}

type ListFrameProps = {
  children: ReactNode
  className?: string
}

/** Divided list without outer border-y chrome. */
export function ListFrame({ children, className }: ListFrameProps) {
  return (
    <div className={cn(UI_SURFACE.listFrame, className)}>{children}</div>
  )
}

type TableScrollProps = {
  children: ReactNode
  className?: string
}

/** Horizontal scroll wrapper for tables on small screens. */
export function TableScroll({ children, className }: TableScrollProps) {
  return (
    <div className={cn(UI_SURFACE.tableScroll, className)}>{children}</div>
  )
}

type EmptyStateProps = {
  title?: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/** Centered empty / placeholder block with optional next-step action. */
export function EmptyState({
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(UI_SURFACE.emptyState, "space-y-3", className)}>
      {title ? (
        <p className="font-heading text-base font-semibold text-foreground">
          {title}
        </p>
      ) : null}
      {description ? <p className="mx-auto max-w-md">{description}</p> : null}
      {children}
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
        </div>
      ) : null}
    </div>
  )
}

type StatsRowProps = {
  children: ReactNode
  className?: string
}

/** Summary metric row under a section heading. */
export function StatsRow({ children, className }: StatsRowProps) {
  return (
    <div className={cn(UI_SURFACE.statsRow, className)}>{children}</div>
  )
}

type FormGridProps = {
  children: ReactNode
  className?: string
}

/** Detail / form field grid. */
export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div className={cn(UI_SURFACE.formGrid, className)}>{children}</div>
  )
}
