"use client";

import Link from "next/link";
import { FileDown, Printer, UserX, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { EmptyState } from "@/src/components/layout/page-section";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { StickyEntityContext } from "@/src/components/layout/sticky-entity-context";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { payRunStatusBadgeVariant } from "@/src/config/ui-colors";
import { PayRunPayslipRow } from "@/src/modules/payroll/components/pay-run-detail";
import type { PayRunDetail } from "@/src/modules/payroll/data/get-pay-runs";
import { payRunEntityTabs } from "@/src/modules/payroll/lib/pay-run-entity-tabs";
import {
  isPayRunEditable,
  isPayRunPosted,
  payRunStatusLabel,
} from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { canReleasePayRunPayslips } from "@/src/modules/payroll/lib/payslip-release";
import { PayrollNav } from "./payroll-nav";
import { ReleasePayslipsButton } from "./release-payslips-button";

export function PayRunPayslipsView({
  run,
  canManage = false,
}: {
  run: PayRunDetail;
  canManage?: boolean;
}) {
  const isPosted = isPayRunPosted(run.status);
  const canEdit = canManage && isPayRunEditable(run.status);
  const included = run.payslips.filter((slip) => !slip.isExcluded);
  const excluded = run.payslips.filter((slip) => slip.isExcluded);
  const base = `/payroll/runs/${run.id}`;
  const showRelease =
    canManage && isPosted && canReleasePayRunPayslips(run.status);

  return (
    <PageShell size="lg">
      <PayrollNav />

      <StickyEntityContext
        title={run.runNumber}
        meta={`${run.period.name} · ${included.length} included${
          excluded.length > 0 ? ` · ${excluded.length} excluded` : ""
        }`}
        badge={
          <Badge variant={payRunStatusBadgeVariant(run.status)}>
            {payRunStatusLabel(run.status)}
          </Badge>
        }
        tabs={[...payRunEntityTabs(run.id, "payslips")]}
      />

      <PageHeader
        title={`Payslips · ${run.runNumber}`}
        description={`${run.period.name} · ${included.length} included${
          excluded.length > 0 ? ` · ${excluded.length} excluded` : ""
        }`}
        backHref={base}
        backLabel="Pay run"
        actions={
          <PageActionsEnd>
            {isPosted ? (
              <>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`${base}/print`} />}
                >
                  <Printer />
                  Batch print · up to 3 per Letter
                </Button>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<a href={`${base}/pdf`} download />}
                >
                  <FileDown />
                  Download PDFs · Letter
                </Button>
                {showRelease ? (
                  <ReleasePayslipsButton
                    payRunId={run.id}
                    unreleasedCount={run.releaseSummary.unreleasedCount}
                  />
                ) : null}
              </>
            ) : null}
          </PageActionsEnd>
        }
      />

      {!isPosted ? (
        <p className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Batch print, PDF download, and release unlock after this pay run is{" "}
          <span className="font-medium text-foreground">posted</span>. You can
          still view, print, exclude, or edit line items on draft slips below.
        </p>
      ) : null}

      <section className="mt-2">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <SectionHeading>Included payslips</SectionHeading>
        </div>

        {included.length === 0 ? (
          <EmptyState
            title="No included payslips"
            description="Include employees on the pay run overview, then calculate the paysheet."
            action={
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={base} />}
              >
                Open overview
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/70">
            {included.map((slip) => (
              <PayRunPayslipRow
                key={slip.id}
                runId={run.id}
                slip={slip}
                canEdit={canEdit}
                isPosted={isPosted}
                runKind={run.runKind}
                currency={run.currency}
              />
            ))}
          </div>
        )}
      </section>

      {excluded.length > 0 ? (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <UserX className="size-4 text-muted-foreground" />
            <SectionHeading>Excluded from this run</SectionHeading>
          </div>
          <div className="divide-y divide-border/70">
            {excluded.map((slip) => (
              <PayRunPayslipRow
                key={slip.id}
                runId={run.id}
                slip={slip}
                canEdit={canEdit}
                isPosted={isPosted}
                runKind={run.runKind}
                currency={run.currency}
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
