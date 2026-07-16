import { cn } from "@/lib/utils";
import type { ModuleStatus } from "@/src/types/module-status";
import { MODULE_STATUS_LABELS } from "@/src/types/module-status";

const statusDotClass: Record<ModuleStatus, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  unavailable: "bg-rose-500",
};

const statusTextClass: Record<ModuleStatus, string> = {
  operational: "text-emerald-700 dark:text-emerald-400",
  degraded: "text-amber-700 dark:text-amber-400",
  unavailable: "text-rose-700 dark:text-rose-400",
};

type ModuleStatusIndicatorProps = {
  status: ModuleStatus;
  label?: string;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function ModuleStatusIndicator({
  status,
  label,
  showLabel = true,
  className,
  size = "md",
}: ModuleStatusIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full",
          size === "sm" ? "size-1.5" : "size-2",
          statusDotClass[status],
        )}
      />
      {showLabel && (
        <span className={cn("font-medium", statusTextClass[status])}>
          {label ?? MODULE_STATUS_LABELS[status]}
        </span>
      )}
      <span className="sr-only">{label ?? MODULE_STATUS_LABELS[status]}</span>
    </span>
  );
}
