import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AchPreviewView } from "@/src/modules/payroll/components/ach-preview-view";
import { getAchPreviewPageData } from "@/src/modules/payroll/data/get-ach-preview";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { preparePayrollPaymentsForPayRun } from "@/src/modules/payroll/services/prepare-payroll-payments";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export const metadata: Metadata = {
  title: "ACH export preview",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AchPreviewPage({ params }: PageProps) {
  const [{ id }, capabilities] = await Promise.all([
    params,
    requirePayrollViewAccess(),
  ]);

  const canView =
    capabilities.can("payroll.ach.view") ||
    capabilities.can("payroll.manage") ||
    capabilities.can("payroll.view");
  if (!canView) {
    notFound();
  }

  // Ensure payment snapshots exist so preview has rows.
  if (
    capabilities.can("payroll.ach.generate") ||
    capabilities.can("payroll.payment_batches.prepare") ||
    capabilities.can("payroll.manage")
  ) {
    const audit = await getAuditRequestMetadata();
    await preparePayrollPaymentsForPayRun({
      payRunId: id,
      actorUserId: capabilities.userId,
      audit,
    });
  }

  const data = await getAchPreviewPageData(id);
  if (!data) {
    notFound();
  }

  return (
    <AchPreviewView
      data={data}
      canGenerate={
        capabilities.can("payroll.ach.generate") ||
        capabilities.can("payroll.payment_batches.export") ||
        capabilities.can("payroll.manage")
      }
      canDownload={
        capabilities.can("payroll.ach.download") ||
        capabilities.can("payroll.bank_accounts.view_sensitive") ||
        capabilities.can("payroll.manage")
      }
      canConfigure={
        capabilities.can("payroll.ach.configure") ||
        capabilities.can("payroll.manage")
      }
    />
  );
}
