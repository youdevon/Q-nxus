"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";

export function PayslipPrintView({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  projectedTaxYearPosition = null,
  isOfficial = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
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

      {/* A4 portrait: one detailed payslip per page. */}
      <div className="mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="payslip-sheet">
          <PayslipDocument
            payslip={payslip}
            meta={meta}
            ytd={ytd}
            ytdBreakdown={ytdBreakdown}
            projectedTaxYearPosition={projectedTaxYearPosition}
            showWarnings={!isOfficial}
            isOfficial={isOfficial}
          />
        </div>
      </div>
    </div>
  );
}
