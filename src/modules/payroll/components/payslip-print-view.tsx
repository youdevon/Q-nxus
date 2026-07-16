"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import type { PayslipYtdTotals } from "@/src/modules/payroll/lib/payslip-ytd";

export function PayslipPrintView({
  payslip,
  meta,
  ytd = null,
  isOfficial = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  isOfficial?: boolean;
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
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {payslip.employee.displayName} · {payslip.period.label}
            {isOfficial ? " · Official" : " · Preview"}
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

      <div className="mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <PayslipDocument
          payslip={payslip}
          meta={meta}
          ytd={ytd}
          showWarnings={!isOfficial}
          isOfficial={isOfficial}
        />
      </div>
    </div>
  );
}
