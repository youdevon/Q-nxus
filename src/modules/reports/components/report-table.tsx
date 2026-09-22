import { cn } from "@/lib/utils";

type ReportTableProps = {
  headers: string[];
  children: React.ReactNode;
  className?: string;
};

export function ReportTable({ headers, children, className }: ReportTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-xs text-muted-foreground">
            {headers.map((header) => (
              <th key={header} className="py-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">{children}</tbody>
      </table>
    </div>
  );
}

export function ReportTableRow({
  children,
}: {
  children: React.ReactNode;
}) {
  return <tr className="align-top">{children}</tr>;
}

export function ReportTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("py-2.5 pr-4", className)}>{children}</td>;
}
