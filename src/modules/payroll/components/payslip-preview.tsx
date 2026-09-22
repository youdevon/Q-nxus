import { ChevronLeft, CircleCheck, FileDown, Printer } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { payslipStatusBadgeVariant } from "@/src/config/ui-colors";
import { UI_MOTION } from "@/src/config/ui-typography";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";

export function PayslipPreviewView({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  projectedTaxYearPosition = null,
  backHref,
  backLabel,
  setupHref,
  printHref,
  printLabel = "Print · Letter",
  pdfHref,
  pdfLabel = "Download PDF · Letter",
  title = "Payslip preview",
  description,
  isOfficial = false,
  isPreviewFallback = false,
  /** Skip PageShell + page header when nested under `/me` layout. */
  embedded = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  backHref: string;
  backLabel: string;
  /** Optional link to payroll setup (manage users). */
  setupHref?: string;
  printHref: string;
  printLabel?: string;
  pdfHref?: string;
  pdfLabel?: string;
  title?: string;
  description?: string;
  isOfficial?: boolean;
  /** When true, clearly labels that no posted payslip exists yet. */
  isPreviewFallback?: boolean;
  embedded?: boolean;
}) {
  const headerDescription =
    description ??
    `${payslip.employee.displayName} · ${payslip.employee.employeeNumber} · ${payslip.period.label}`;

  const actions = (
    <PageActionsEnd>
      {setupHref ? (
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={setupHref} />}
        >
          Payroll setup
        </Button>
      ) : null}
      <Button
        nativeButton={false}
        variant="outline"
        render={<Link href={printHref} />}
      >
        <Printer />
        {printLabel}
      </Button>
      {pdfHref ? (
        <Button
          nativeButton={false}
          variant="outline"
          render={<a href={pdfHref} download />}
        >
          <FileDown />
          {pdfLabel}
        </Button>
      ) : null}
    </PageActionsEnd>
  );

  const body = (
    <>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link href={backHref} className={UI_MOTION.backLink}>
              <ChevronLeft className="size-3.5" aria-hidden />
              {backLabel}
            </Link>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{headerDescription}</p>
          </div>
          {actions}
        </div>
      ) : (
        <PageHeader
          title={title}
          description={headerDescription}
          backHref={backHref}
          backLabel={backLabel}
          actions={actions}
        />
      )}

      {isOfficial ? (
        <section className="mb-4">
          <Badge variant={payslipStatusBadgeVariant("POSTED")}>
            <CircleCheck />
            Posted payslip
          </Badge>
        </section>
      ) : isPreviewFallback ? (
        <section className="mb-4">
          <Badge variant="outline">Preview — no posted payslip yet</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            Showing a live preview because no posted pay run exists for you yet.
            Official history appears here after payroll posts a run.
          </p>
        </section>
      ) : payslip.warnings.length === 0 ? (
        <section className="mb-4">
          <Badge variant="success">
            <CircleCheck />
            Ready for preview
          </Badge>
        </section>
      ) : null}

      <PayslipDocument
        payslip={payslip}
        meta={meta}
        ytd={ytd}
        ytdBreakdown={ytdBreakdown}
        projectedTaxYearPosition={projectedTaxYearPosition}
        showWarnings={!isOfficial && payslip.warnings.length > 0}
        isOfficial={isOfficial}
      />
    </>
  );

  if (embedded) {
    return body;
  }

  return <PageShell size="md">{body}</PageShell>;
}
