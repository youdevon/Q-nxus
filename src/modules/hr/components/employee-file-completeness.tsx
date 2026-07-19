import Link from "next/link";

import { PageAlert } from "@/src/components/ui/page-alert";

type EmployeeFileCompletenessProps = {
  completeCount: number;
  totalCount: number;
  percentComplete: number;
  isComplete: boolean;
  missingLabels?: string[];
  documentsHref: string;
  /** Show incomplete warning alert (HR profile / documents). */
  showWarning?: boolean;
  className?: string;
};

export function EmployeeFileCompletenessBar({
  completeCount,
  totalCount,
  percentComplete,
  className,
}: Pick<
  EmployeeFileCompletenessProps,
  "completeCount" | "totalCount" | "percentComplete" | "className"
>) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {completeCount} of {totalCount} file items complete
        </span>
        <span>{percentComplete}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Employee file completeness"
      >
        <div
          className="h-full rounded-full bg-foreground/70 transition-[width]"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
}

export function EmployeeFileCompletenessWarning({
  completeCount,
  totalCount,
  missingLabels = [],
  documentsHref,
}: Pick<
  EmployeeFileCompletenessProps,
  "completeCount" | "totalCount" | "missingLabels" | "documentsHref"
>) {
  const missingSummary =
    missingLabels.length > 0
      ? missingLabels.slice(0, 3).join(", ") +
        (missingLabels.length > 3 ? ` (+${missingLabels.length - 3} more)` : "")
      : null;

  return (
    <PageAlert severity="warning" title="Employee file incomplete">
      {completeCount} of {totalCount} file items complete
      {missingSummary ? ` — missing: ${missingSummary}` : ""}. This does not
      block payroll.{" "}
      <Link
        href={documentsHref}
        className="font-medium underline underline-offset-2 hover:text-foreground"
      >
        Open employee file
      </Link>
    </PageAlert>
  );
}
