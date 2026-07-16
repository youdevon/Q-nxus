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
  children: ReactNode
  className?: string
}

/** Centered empty / placeholder block. */
export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <div className={cn(UI_SURFACE.emptyState, className)}>{children}</div>
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

/** Responsive form / detail field grid. */
export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div className={cn(UI_SURFACE.formGrid, className)}>{children}</div>
  )
}
