import type { ComponentType } from "react"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  OctagonAlertIcon,
} from "lucide-react"

import type { Severity } from "@/src/types/severity"

export const severityIconMap = {
  success: CheckCircle2Icon,
  information: InfoIcon,
  warning: AlertTriangleIcon,
  error: AlertCircleIcon,
  critical: OctagonAlertIcon,
} as const satisfies Record<Severity, ComponentType<{ className?: string }>>

export const severityAccentClass: Record<Severity, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  information: "text-sky-600 dark:text-sky-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
  critical: "text-rose-700 dark:text-rose-400",
}
