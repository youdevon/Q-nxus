import { CircleCheck, Printer } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { payslipStatusBadgeVariant } from "@/src/config/ui-colors";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { PayslipDocument } from "@/src/modules/payroll/components/payslip-document";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";

export function PayslipPreviewView({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  backHref,
  backLabel,
  setupHref,
  printHref,
  printLabel = "Print",
  title = "Payslip preview",
  description,
  isOfficial = false,
  isPreviewFallback = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd?: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  backHref: string;
  backLabel: string;
  /** Optional link to payroll setup (manage users). */
  setupHref?: string;
  printHref: string;
  printLabel?: string;
  title?: string;
  description?: string;
  isOfficial?: boolean;
  /** When true, clearly labels that no posted payslip exists yet. */
  isPreviewFallback?: boolean;
}) {
  const headerDescription =
    description ??
    `${payslip.employee.displayName} · ${payslip.employee.employeeNumber} · ${payslip.period.label}`;

  return (
    <PageShell size="md">
      <PageHeader
        title={title}
        description={headerDescription}
        backHref={backHref}
        backLabel={backLabel}
        actions={
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
          </PageActionsEnd>
        }
      />

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
        showWarnings={!isOfficial && payslip.warnings.length > 0}
        isOfficial={isOfficial}
      />
    </PageShell>
  );
}
