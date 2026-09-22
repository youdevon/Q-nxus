"use client";

import { Printer, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { closePrintView } from "@/src/lib/close-print-view";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";

function PrintToolbarActions({
  closeHref,
  printLabel,
}: {
  closeHref: string;
  printLabel: string;
}) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => window.print()}
      >
        <Printer />
        {printLabel}
      </Button>
      <Button
        nativeButton={false}
        variant="ghost"
        className="w-full sm:w-auto"
        render={<Link href={closeHref} />}
        onClick={(event) => {
          if (typeof window === "undefined") {
            return;
          }
          if (window.opener && !window.opener.closed) {
            event.preventDefault();
            closePrintView(closeHref);
          }
        }}
      >
        <X />
        Close
      </Button>
    </div>
  );
}

export function PayslipPrintView({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  projectedTaxYearPosition = null,
  isOfficial = false,
  closeHref = "/payroll",
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  isOfficial?: boolean;
  /** Where Close goes when there is no useful history / referrer. */
  closeHref?: string;
}) {
  return (
    <div className="payslip-print-page payslip-print-letter min-h-full w-full min-w-0 bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-50 border-b border-border/70 bg-background px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-[8.5in] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-words text-foreground">
              {payslip.employee.displayName} · {payslip.period.label}
              {isOfficial ? " · Official" : " · Preview"}
              {" · Letter"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set paper to Letter, scale to 100%. Disable &quot;Headers and
              footers&quot; for the cleanest printout.
            </p>
          </div>
          <PrintToolbarActions closeHref={closeHref} printLabel="Print · Letter" />
        </div>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-[8.5in] px-3 py-4 sm:px-4 sm:py-6 print:max-w-none print:px-0 print:py-0">
        <div className="payslip-sheet min-w-0 overflow-x-auto">
          <PayslipDocument
            payslip={payslip}
            meta={meta}
            ytd={ytd}
            ytdBreakdown={ytdBreakdown}
            projectedTaxYearPosition={projectedTaxYearPosition}
            showWarnings={false}
            isOfficial={isOfficial}
          />
        </div>
      </div>
    </div>
  );
}
