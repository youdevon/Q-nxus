import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

import {
  getAuditEvents,
  type AuditFilters,
  type AuditTrailData,
} from "@/src/modules/admin/data/get-audit-events";
import { resolveAuditLabels } from "@/src/modules/admin/data/resolve-audit-labels";
import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditModule,
} from "@/src/lib/audit-display";

export { type AuditFilters, type AuditTrailData };

const EXPORT_LIMIT = 5000;

function parseStartDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseEndDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Fetch audit events for CSV export (same filters as the audit trail page). */
export async function getAuditEventsForExport(
  filters: AuditFilters,
): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  const query = filters.query?.trim();
  const dateFrom = parseStartDate(filters.dateFrom);
  const dateTo = parseEndDate(filters.dateTo);

  const orgScope = organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : null;

  const queryScope = query
    ? {
        OR: [
          { description: { contains: query, mode: "insensitive" as const } },
          { action: { contains: query, mode: "insensitive" as const } },
          { entityType: { contains: query, mode: "insensitive" as const } },
          { entityId: { contains: query, mode: "insensitive" as const } },
          {
            user: {
              is: {
                OR: [
                  { email: { contains: query, mode: "insensitive" as const } },
                  {
                    firstName: { contains: query, mode: "insensitive" as const },
                  },
                  {
                    lastName: { contains: query, mode: "insensitive" as const },
                  },
                ],
              },
            },
          },
        ],
      }
    : null;

  const where = {
    AND: [
      ...(orgScope ? [orgScope] : []),
      ...(filters.moduleKey ? [{ moduleKey: filters.moduleKey }] : []),
      ...(filters.action ? [{ action: filters.action }] : []),
      ...(filters.entityType ? [{ entityType: filters.entityType }] : []),
      ...(dateFrom || dateTo
        ? [
            {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            },
          ]
        : []),
      ...(queryScope ? [queryScope] : []),
    ],
  };

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    select: {
      id: true,
      moduleKey: true,
      action: true,
      entityType: true,
      entityId: true,
      description: true,
      ipAddress: true,
      correlationId: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const labelsMap = await resolveAuditLabels({
    entityRefs: events
      .filter((event) => event.entityId)
      .map((event) => ({
        entityType: event.entityType,
        entityId: event.entityId as string,
      })),
    changeValues: [],
  });

  const headers = [
    "Timestamp (UTC)",
    "User",
    "Email",
    "Module",
    "Action",
    "Entity type",
    "Entity",
    "Description",
    "IP address",
    "Correlation ID",
  ];

  const rows = events.map((event) => {
    const entityLabel =
      event.entityId != null
        ? (labelsMap.get(event.entityId) ?? event.entityId)
        : "";

    const userName = event.user
      ? `${event.user.firstName} ${event.user.lastName}`.trim()
      : "";

    return [
      event.createdAt.toISOString(),
      userName,
      event.user?.email ?? "",
      formatAuditModule(event.moduleKey),
      formatAuditAction(event.action),
      formatAuditEntityType(event.entityType),
      entityLabel,
      event.description ?? "",
      event.ipAddress ?? "",
      event.correlationId ?? "",
    ];
  });

  return { headers, rows };
}

export async function getAuditTrailReportData(
  filters: AuditFilters,
): Promise<AuditTrailData> {
  return getAuditEvents(filters);
}
