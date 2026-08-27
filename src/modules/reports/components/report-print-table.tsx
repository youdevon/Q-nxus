import { cn } from "@/lib/utils";

type ReportPrintTableProps = {
  headers: string[];
  children: React.ReactNode;
  className?: string;
  alignRightFrom?: number;
};

export function ReportPrintTable({
  headers,
  children,
  className,
  alignRightFrom,
}: ReportPrintTableProps) {
  return (
    <div className={cn("report-print-table-wrap overflow-x-auto", className)}>
      <table className="report-print-table w-full text-left text-sm">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={cn(
                  "border-b border-neutral-300 py-2 pr-3 text-xs font-semibold text-neutral-600",
                  alignRightFrom != null && index >= alignRightFrom
                    ? "text-right"
                    : undefined,
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ReportPrintTableRow({
  children,
}: {
  children: React.ReactNode;
}) {
  return <tr className="border-b border-neutral-200 align-top">{children}</tr>;
}

export function ReportPrintTableCell({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "py-2 pr-3 text-neutral-900",
        align === "right" ? "text-right tabular-nums" : undefined,
        className,
      )}
    >
      {children}
    </td>
  );
}

export function ReportPrintSummaryGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section className="report-print-summary mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-neutral-500">{item.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}

export function ReportPrintSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("report-print-section mb-6", className)}>
      {title ? (
        <h2 className="mb-3 text-sm font-semibold text-neutral-800">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function ReportPrintEmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-neutral-500">{message}</p>
  );
}

export function ReportPrintMuted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-neutral-500">{children}</span>;
}
