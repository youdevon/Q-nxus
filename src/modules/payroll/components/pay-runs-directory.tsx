"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CalendarRange, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { payRunStatusBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDate } from "@/src/lib/format";
import type { PayRunListItem } from "@/src/modules/payroll/data/get-pay-runs";
import {
  isPayRunPosted,
  payRunStatusLabel,
} from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { PayrollNav } from "./payroll-nav";

function formatDate(iso: string | null) {
  return formatDisplayDate(iso, { fallback: "—" });
}

function runKindLabel(kind: PayRunListItem["runKind"]) {
  switch (kind) {
    case "CORRECTION":
      return "Correction";
    case "OFF_CYCLE":
      return "Off-cycle";
    default:
      return null;
  }
}

function DeletedPayRunToast({
  deletedRunNumber,
}: {
  deletedRunNumber: string | null;
}) {
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!deletedRunNumber || shownRef.current) {
      return;
    }

    shownRef.current = true;
    toast.success(`Draft pay run ${deletedRunNumber} deleted.`);
    router.replace("/payroll/runs");
  }, [deletedRunNumber, router]);

  return null;
}

export function PayRunsDirectory({
  runs,
  canManage,
  deletedRunNumber = null,
}: {
  runs: PayRunListItem[];
  canManage: boolean;
  deletedRunNumber?: string | null;
}) {
  return (
    <PageShell size="lg">
      <PayrollNav />
      <DeletedPayRunToast deletedRunNumber={deletedRunNumber} />

      <PageHeader
        title="Pay runs"
        description="Monthly payroll periods and pay runs. Draft runs snapshot current calc; posting freezes amounts."
        actions={
          canManage ? (
            <Button
              nativeButton={false}
              render={<Link href="/payroll/runs/new" />}
            >
              <Plus />
              New period
            </Button>
          ) : undefined
        }
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <SectionHeading>Runs & periods</SectionHeading>
        </div>

        {runs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No pay runs yet.
            {canManage
              ? " Create a monthly period to include payroll-ready employees."
              : ""}
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {runs.map((run) => (
              <div
                key={run.id}
                className="grid gap-3 py-5 md:grid-cols-[1fr_8rem_8rem_8rem_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{run.runNumber}</p>
                    <Badge variant={payRunStatusBadgeVariant(run.status)}>
                      {isPayRunPosted(run.status) ? (
                        <>
                          <CircleCheck />
                          {payRunStatusLabel(run.status)}
                        </>
                      ) : (
                        payRunStatusLabel(run.status)
                      )}
                    </Badge>
                    {runKindLabel(run.runKind) ? (
                      <Badge variant="outline">{runKindLabel(run.runKind)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {run.period.name} · {run.employeeCount} employees
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-sm font-medium">{run.totalGross}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-sm font-medium">{run.totalNet}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isPayRunPosted(run.status) ? "Posted" : "Created"}
                  </p>
                  <p className="text-sm font-medium">
                    {formatDate(
                      isPayRunPosted(run.status) ? run.postedAt : run.createdAt,
                    )}
                  </p>
                </div>
                <div className="flex items-center md:justify-end">
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={<Link href={`/payroll/runs/${run.id}`} />}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
