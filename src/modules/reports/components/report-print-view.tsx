"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ReportPrintViewProps = {
  title: string;
  organizationName: string;
  metaLines?: string[];
  generatedAtLabel: string;
  toolbarLabel?: string;
  children: React.ReactNode;
};

export function ReportPrintView({
  title,
  organizationName,
  metaLines = [],
  generatedAtLabel,
  toolbarLabel,
  children,
}: ReportPrintViewProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="report-print-page min-h-full bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {toolbarLabel ?? title}
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

      <div className="report-print-document mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <header className="report-print-header mb-6 border-b border-neutral-300 pb-4">
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            {organizationName}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">{title}</h1>
          {metaLines.length > 0 ? (
            <div className="mt-2 space-y-0.5 text-sm text-neutral-600">
              {metaLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-neutral-500">
            Generated {generatedAtLabel}
          </p>
        </header>

        {children}
      </div>
    </div>
  );
}
