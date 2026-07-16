import type { Metadata } from "next";

import { AuditTrail } from "@/src/modules/admin/components/audit-trail";
import {
  getAuditEvents,
  type AuditFilters,
} from "@/src/modules/admin/data/get-audit-events";

export const metadata: Metadata = {
  title: "Audit Trail",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  moduleKey?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}>;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const filters: AuditFilters = {
    query: params.query,
    moduleKey: params.moduleKey,
    action: params.action,
    entityType: params.entityType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: params.page ? Number(params.page) : 1,
  };

  const data = await getAuditEvents(filters);

  return <AuditTrail data={data} currentFilters={filters} />;
}
