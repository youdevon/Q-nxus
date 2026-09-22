"use client";

import { Printer, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { closePrintView } from "@/src/lib/close-print-view";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import {
  estimatePayslipPrintUnits,
  packPayslipPrintUnits,
  summarizePayslipPacking,
} from "@/src/modules/payroll/lib/pack-payslip-sheets";
import {
  isPayslipMetaAllowanceLine,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
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

function isBankDeductionLabel(label: string): boolean {
  return label.startsWith("Bank transfer");
}

function printUnitsForDocument(doc: PayslipBatchPrintDocument): number {
  const extraEarningLines = doc.payslip.earnings.filter(
    (line) => !isPayslipMetaAllowanceLine(line),
  ).length;
  const deductionLines = doc.payslip.deductions.filter(
    (line) => !isBankDeductionLabel(line.label),
  ).length;
  return estimatePayslipPrintUnits({
    extraEarningLines,
    deductionLines,
    hasYtd: doc.ytd != null,
  });
}

function packDocuments(
  documents: PayslipBatchPrintDocument[],
): PayslipBatchPrintDocument[][] {
  const units = documents.map(printUnitsForDocument);
  return packPayslipPrintUnits(units).map((indexes) =>
    indexes
      .map((index) => documents[index])
      .filter((doc): doc is PayslipBatchPrintDocument => doc != null),
  );
}

function PayslipSlot({ doc }: { doc: PayslipBatchPrintDocument }) {
  return (
    <div className="payslip-sheet payslip-letter-slot min-w-0 overflow-x-auto">
      <PayslipDocument
        payslip={doc.payslip}
        meta={doc.meta}
        ytd={doc.ytd}
        ytdBreakdown={doc.ytdBreakdown}
        projectedTaxYearPosition={doc.projectedTaxYearPosition}
        showWarnings={false}
        isOfficial={doc.isOfficial}
      />
    </div>
  );
}

function BatchToolbarActions({ closeHref }: { closeHref: string }) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => window.print()}
      >
        <Printer />
        Batch print · up to 3 per Letter
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

/**
 * Batch print: packs up to 3 existing payslips per Letter sheet using
 * print-compact height estimates (not on-screen measurements).
 */
export function PayslipBatchPrintView({
  title,
  subtitle,
  documents,
  skippedNotes = [],
  closeHref = "/payroll",
}: {
  title: string;
  subtitle?: string;
  documents: PayslipBatchPrintDocument[];
  skippedNotes?: string[];
  /** Where to go when Close has no same-origin referrer (e.g. new tab). */
  closeHref?: string;
}) {
  const sheets = useMemo(() => packDocuments(documents), [documents]);
  const packing = useMemo(() => summarizePayslipPacking(sheets), [sheets]);
  const packingHint =
    packing.maxOnSheet >= 3
      ? `Up to 3 per Letter · layout ${packing.packingLabel}`
      : packing.maxOnSheet === 2
        ? `2 per Letter · layout ${packing.packingLabel}`
        : `1 per Letter · layout ${packing.packingLabel}`;

  if (documents.length === 0) {
    return (
      <div className="payslip-print-page min-h-full w-full min-w-0 bg-muted/40 print:bg-white">
        <div className="print:hidden sticky top-0 z-50 border-b border-border/70 bg-background px-3 py-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-[8.5in] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm font-medium break-words">{title}</p>
            <BatchToolbarActions closeHref={closeHref} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[8.5in] px-3 py-12 sm:px-4">
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
    <div className="payslip-print-page payslip-print-batch-letter min-h-full w-full min-w-0 bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-50 border-b border-border/70 bg-background px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-[8.5in] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-words text-foreground">
              {title}
            </p>
            <p className="mt-1 text-xs break-words text-muted-foreground">
              {subtitle ? `${subtitle} · ` : null}
              {packingHint}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compact slips pack 3 per Letter; slips with YTD or many lines use
              2; very dense slips use 1. Paper: Letter · scale 100%. Disable
              headers and footers for the cleanest printout.
            </p>
          </div>
          <BatchToolbarActions closeHref={closeHref} />
        </div>
        {skippedNotes.length > 0 ? (
          <div className="mx-auto mt-2 w-full max-w-[8.5in]">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {skippedNotes.length} employee
              {skippedNotes.length === 1 ? "" : "s"} skipped — see notes below
              print toolbar.
            </p>
          </div>
        ) : null}
      </div>

      {skippedNotes.length > 0 ? (
        <div className="print:hidden mx-auto w-full max-w-[8.5in] px-3 pt-4 sm:px-4">
          <ul className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
            {skippedNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mx-auto w-full min-w-0 max-w-[8.5in] space-y-8 px-3 py-4 sm:px-4 sm:py-6 print:max-w-none print:space-y-0 print:px-0 print:py-0">
        {sheets.map((sheet, sheetIndex) => (
          <div
            key={`sheet-${sheet[0]?.key ?? sheetIndex}`}
            className="payslip-letter-sheet min-w-0"
          >
            {sheet.map((doc, slotIndex) => (
              <div key={doc.key} className="min-w-0">
                {slotIndex > 0 ? (
                  <div
                    className="payslip-cut-guide print:block hidden"
                    aria-hidden
                  />
                ) : null}
                <div className="mb-6 print:mb-0">
                  <PayslipSlot doc={doc} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
