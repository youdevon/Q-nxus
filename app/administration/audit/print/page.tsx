import type { Metadata } from "next";

import {
  AuditTrailPrintContent,
  auditTrailMetaLines,
} from "@/src/modules/admin/components/audit-trail-print-content";
import type { AuditFilters } from "@/src/modules/admin/data/get-audit-events";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Print audit trail",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  moduleKey?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

export default async function AuditTrailPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.can("administration.view")) {
    notFound();
  }

  const params = await searchParams;
  const filters: AuditFilters = {
    query: params.query,
    moduleKey: params.moduleKey,
    action: params.action,
    entityType: params.entityType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: 1,
  };

  return (
    <ReportPrintPage
      title="Audit trail export"
      metaLines={auditTrailMetaLines(filters)}
    >
      <AuditTrailPrintContent filters={filters} />
    </ReportPrintPage>
  );
}
