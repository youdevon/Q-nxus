import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { UI_MOTION, UI_SURFACE } from "@/src/config/ui-typography";
import type { SelfServicePayslipHistoryItem } from "@/src/modules/payroll/data/get-stored-payslip";

function runKindLabel(kind: "REGULAR" | "CORRECTION" | "OFF_CYCLE"): string {
  return kind === "CORRECTION"
    ? "Correction"
    : kind === "OFF_CYCLE"
      ? "Off-cycle"
      : "Regular";
}

export function SelfServicePayslipHistory({
  items,
  heading = "Payslips",
  emptyMessage = "No posted payslips yet.",
  className,
}: {
  items: SelfServicePayslipHistoryItem[];
  heading?: string;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" />
        <SectionHeading>{heading}</SectionHeading>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className={UI_SURFACE.listFrame}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.viewHref}
                className={cn(
                  UI_SURFACE.listRow,
                  "grid md:grid-cols-[1fr_8rem_8rem_auto] md:items-center",
                  UI_MOTION.interactive,
                  "rounded-md outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
                aria-label={`${item.periodName} payslip`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.periodName}</p>
                    {item.runKind !== "REGULAR" ? (
                      <Badge variant="outline">
                        {runKindLabel(item.runKind)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.runNumber}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-sm font-medium">{item.grossPay}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-sm font-medium">{item.netPay}</p>
                </div>

                <div className="flex items-center justify-end text-muted-foreground">
                  <ChevronRight className="size-4" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
