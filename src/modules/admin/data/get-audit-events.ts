import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

import { resolveAuditLabels } from "@/src/modules/admin/data/resolve-audit-labels";

const PAGE_SIZE = 25;

export type AuditEventListItem = {
  id: string;
  moduleKey: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /** Human-readable subject for the record (name, title, run number, etc.). */
  entityLabel: string | null;
  description: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  clientHostName: string | null;
  correlationId: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type AuditFilters = {
  query?: string;
  moduleKey?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

export type AuditTrailData = {
  events: AuditEventListItem[];
  /** Resolved labels for FK ids appearing in change payloads on this page. */
  referenceLabels: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    modules: string[];
    actions: string[];
    entityTypes: string[];
  };
};

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

export async function getAuditEvents(
  filters: AuditFilters,
): Promise<AuditTrailData> {
  const page =
    Number.isInteger(filters.page) && Number(filters.page) > 0
      ? Number(filters.page)
      : 1;

  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  const query = filters.query?.trim();
  const dateFrom = parseStartDate(filters.dateFrom);
  const dateTo = parseEndDate(filters.dateTo);

  const orgScope = organizationId
    ? {
        OR: [{ organizationId }, { organizationId: null }],
      }
    : null;

  const queryScope = query
    ? {
        OR: [
          {
            description: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            action: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            entityType: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            entityId: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            user: {
              is: {
                OR: [
                  {
                    email: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    firstName: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    lastName: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
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

  const [events, total, modules, actions, entityTypes] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        moduleKey: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        clientHostName: true,
        correlationId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),

    prisma.auditEvent.count({
      where,
    }),

    prisma.auditEvent.findMany({
      distinct: ["moduleKey"],
      orderBy: {
        moduleKey: "asc",
      },
      select: {
        moduleKey: true,
      },
    }),

    prisma.auditEvent.findMany({
      distinct: ["action"],
      orderBy: {
        action: "asc",
      },
      select: {
        action: true,
      },
    }),

    prisma.auditEvent.findMany({
      distinct: ["entityType"],
      orderBy: {
        entityType: "asc",
      },
      select: {
        entityType: true,
      },
    }),
  ]);

  const labelMap = await resolveAuditLabels({
    entityRefs: events
      .filter((event) => event.entityId)
      .map((event) => ({
        entityType: event.entityType,
        entityId: event.entityId as string,
      })),
    changeValues: events.flatMap((event) => [
      event.oldValues,
      event.newValues,
    ]),
  });

  const referenceLabels = Object.fromEntries(labelMap.entries());

  return {
    events: events.map((event) => ({
      ...event,
      entityLabel: event.entityId
        ? (labelMap.get(event.entityId) ?? null)
        : null,
    })),
    referenceLabels,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    filters: {
      modules: modules.map((item) => item.moduleKey),
      actions: actions.map((item) => item.action),
      entityTypes: entityTypes.map((item) => item.entityType),
    },
  };
}
