import type { ComponentProps, ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import {
  severityAccentClass,
  severityIconMap,
} from "@/src/modules/notifications/lib/severity-styles"
import type { Severity } from "@/src/types/severity"
import { SEVERITY_LABELS } from "@/src/types/severity"

const pageAlertVariants = cva("border-l-[3px]", {
  variants: {
    severity: {
      success:
        "border-l-emerald-500 bg-emerald-500/8 text-foreground *:data-[slot=alert-description]:text-muted-foreground",
      information:
        "border-l-sky-500 bg-sky-500/8 text-foreground *:data-[slot=alert-description]:text-muted-foreground",
      warning:
        "border-l-amber-500 bg-amber-500/10 text-foreground *:data-[slot=alert-description]:text-muted-foreground",
      error:
        "border-l-destructive bg-destructive/8 text-foreground *:data-[slot=alert-description]:text-muted-foreground",
      critical:
        "border-l-rose-700 bg-rose-600/10 text-foreground *:data-[slot=alert-description]:text-muted-foreground dark:border-l-rose-400",
    } satisfies Record<Severity, string>,
  },
  defaultVariants: {
    severity: "information",
  },
})

type PageAlertProps = ComponentProps<"div"> &
  VariantProps<typeof pageAlertVariants> & {
    title?: string
    children: ReactNode
    severity: Severity
  }

/**
 * Standard page-level alert reused across HR, Payroll, and future modules.
 * Prefer this over ad-hoc banners so severity language stays consistent.
 */
export function PageAlert({
  className,
  severity,
  title,
  children,
  ...props
}: PageAlertProps) {
  const Icon = severityIconMap[severity]

  return (
    <Alert
      data-severity={severity}
      className={cn(pageAlertVariants({ severity }), className)}
      {...props}
    >
      <Icon className={cn("size-4", severityAccentClass[severity])} />
      <AlertTitle>{title ?? SEVERITY_LABELS[severity]}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
