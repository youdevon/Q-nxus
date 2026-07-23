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

export type PayslipBatchPrintDocument = {
  key: string;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  isOfficial?: boolean;
};

/**
 * Shell-less multi-document print surface.
 * A4 portrait — one detailed payslip per page.
 * Prefer browser Print → Save as PDF for a true multi-page PDF.
 */
export function PayslipBatchPrintView({
  title,
  subtitle,
  documents,
  skippedNotes = [],
}: {
  title: string;
  subtitle?: string;
  documents: PayslipBatchPrintDocument[];
  skippedNotes?: string[];
}) {
  useEffect(() => {
    if (documents.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [documents.length]);

  if (documents.length === 0) {
    return (
      <div className="payslip-print-page min-h-full bg-muted/40 print:bg-white">
        <div className="print:hidden sticky top-0 z-10 border-b border-border/70 bg-background/95 px-4 py-3">
          <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{title}</p>
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
        <div className="mx-auto max-w-[210mm] px-4 py-12">
          <p className="text-sm font-medium text-foreground">
            No payslips available to print.
          </p>
          {skippedNotes.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {skippedNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Resolve readiness or include employees, then try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="payslip-print-page min-h-full bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer />
              Print / Save PDF
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
        {skippedNotes.length > 0 ? (
          <div className="mx-auto mt-2 max-w-[210mm]">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {skippedNotes.length} employee
              {skippedNotes.length === 1 ? "" : "s"} skipped — see notes below
              print toolbar.
            </p>
          </div>
        ) : null}
      </div>

      {skippedNotes.length > 0 ? (
        <div className="print:hidden mx-auto max-w-[210mm] px-4 pt-4">
          <ul className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
            {skippedNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mx-auto max-w-[210mm] space-y-8 px-4 py-6 print:max-w-none print:space-y-0 print:px-0 print:py-0">
        {documents.map((doc) => (
          <div key={doc.key} className="payslip-batch-page payslip-sheet">
            <PayslipDocument
              payslip={doc.payslip}
              meta={doc.meta}
              ytd={doc.ytd}
              ytdBreakdown={doc.ytdBreakdown}
              projectedTaxYearPosition={doc.projectedTaxYearPosition}
              showWarnings={!doc.isOfficial}
              isOfficial={doc.isOfficial}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
