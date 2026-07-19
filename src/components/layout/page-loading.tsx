import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/src/components/layout/page-shell";

type PageLoadingProps = {
  /** `md` for detail/forms, `lg` for directories/workspaces. */
  size?: "md" | "lg" | "xl";
  /** Show a secondary nav strip skeleton (People / Administration / Payroll). */
  showNav?: boolean;
  /** Approximate rows for a list/directory skeleton. */
  rows?: number;
};

/**
 * Shared route-level loading shell. Matches PageShell spacing without inventing a card look.
 */
export function PageLoading({
  size = "lg",
  showNav = true,
  rows = 6,
}: PageLoadingProps) {
  return (
    <PageShell size={size}>
      {showNav ? (
        <div className="-mt-1 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      ) : null}

      <div className="space-y-3">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>

      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
