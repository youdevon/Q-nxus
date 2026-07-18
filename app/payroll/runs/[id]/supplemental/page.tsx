import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CreateSupplementalPayRunForm } from "@/src/modules/payroll/components/create-supplemental-pay-run-form";
import { getPayRunDetail } from "@/src/modules/payroll/data/get-pay-runs";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";

export const metadata: Metadata = {
  title: "Correction / off-cycle run",
};

export const dynamic = "force-dynamic";

type SupplementalPayRunPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
};

export default async function SupplementalPayRunPage({
  params,
  searchParams,
}: SupplementalPayRunPageProps) {
  const capabilities = await requirePayrollManageAccess();
  const { id } = await params;
  const { kind } = await searchParams;
  const source = await getPayRunDetail(id, {
    actorUserId: capabilities.userId,
  });

  if (!source || !isPayRunPosted(source.status)) {
    notFound();
  }

  const readiness = await getPayrollReadiness();
  const sourceEmployeeIds = new Set(
    source.payslips
      .filter((slip) => !slip.isExcluded)
      .map((slip) => slip.employeeId),
  );

  const defaultRunKind =
    kind?.toUpperCase() === "OFF_CYCLE" ? "OFF_CYCLE" : "CORRECTION";

  return (
    <CreateSupplementalPayRunForm
      sourcePayRunId={source.id}
      sourceRunNumber={source.runNumber}
      periodName={source.period.name}
      defaultRunKind={defaultRunKind}
      employees={readiness.rows.map((row) => ({
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        displayName: row.displayName,
        departmentName: row.departmentName,
        isReady: row.isReady,
        wasInSourceRun: sourceEmployeeIds.has(row.employeeId),
      }))}
    />
  );
}
