"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  AnnualPayeProjectionPrintDocument,
  type AnnualPayeProjectionPrintContext,
  type AnnualPayeProjectionPrintEmployee,
} from "@/src/modules/payroll/components/annual-paye-projection-print-document";
import type { AnnualPayeProjectionResult } from "@/src/modules/payroll/lib/annual-paye-projection";

export function AnnualPayeProjectionPrintView({
  employee,
  context,
  projection,
  isMidYearJoiner = false,
}: {
  employee: AnnualPayeProjectionPrintEmployee;
  context: AnnualPayeProjectionPrintContext;
  projection: AnnualPayeProjectionResult;
  isMidYearJoiner?: boolean;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="payslip-print-page min-h-full bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {employee.displayName} · Annual PAYE projection {context.taxYear}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.history.back()}
            >
              <X />
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[8.5in] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="payslip-sheet rounded-md bg-white p-6 print:rounded-none print:p-0">
          <AnnualPayeProjectionPrintDocument
            employee={employee}
            context={context}
            projection={projection}
            isMidYearJoiner={isMidYearJoiner}
          />
        </div>
      </div>
    </div>
  );
}
