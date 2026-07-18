import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canEmployeeAcknowledgeCorrespondence,
  isAcknowledgementOverdue,
  isEmployeeVisibleCorrespondence,
} from "@/src/modules/hr/lib/correspondence-visibility";
import {
  canEmployeeSubmitCorrespondenceResponse,
  canEmployeeUpdateCorrespondenceResponse,
  canHrReviewCorrespondenceResponse,
} from "@/src/modules/hr/lib/correspondence-response";

function formatDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function userDisplayName(
  user: { firstName: string; lastName: string } | null | undefined,
): string | null {
  if (!user) {
    return null;
  }

  return `${user.firstName} ${user.lastName}`;
}

export type CorrespondenceAttachmentSummary = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  viewHref: string;
  downloadHref: string;
};

export type CorrespondenceResponseSummary = {
  id: string;
  body: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  attachment: {
    fileName: string;
    viewHref: string;
    downloadHref: string;
  } | null;
};

export type CorrespondenceListItem = {
  id: string;
  category: string;
  subType: string | null;
  title: string;
  status: string;
  employeeVisible: boolean;
  managerVisible: boolean;
  requiresAcknowledgement: boolean;
  allowsEmployeeResponse: boolean;
  effectiveDate: string;
  issueDate: string | null;
  retentionUntil: string | null;
  attachmentCount: number;
  issuedByName: string | null;
  canAcknowledge: boolean;
  isAckOverdue: boolean;
};

export type CorrespondenceChainItem = {
  id: string;
  title: string;
  status: string;
  issueDate: string | null;
  effectiveDate: string;
};

export type CorrespondenceDetail = CorrespondenceListItem & {
  body: string | null;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  createdAt: string;
  updatedAt: string;
  supersedesId: string | null;
  supersededById: string | null;
  templateId: string | null;
  relatedCorrespondenceId: string | null;
  relatedLetters: CorrespondenceChainItem[];
  canIssueAssumptionOfDuty: boolean;
  canSubmitResponse: boolean;
  canUpdateResponse: boolean;
  canReviewResponse: boolean;
  employeeResponse: CorrespondenceResponseSummary | null;
  attachments: CorrespondenceAttachmentSummary[];
  chain: CorrespondenceChainItem[];
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
};

export type EmployeeCorrespondenceList = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  items: CorrespondenceListItem[];
  pendingAcknowledgementCount: number;
  overdueAcknowledgementCount: number;
};

export type CorrespondenceListFilters = {
  category?: string;
  status?: string;
  subType?: string;
  overdueAck?: boolean;
  expiringRetention?: boolean;
};

function responseAttachmentUrls(
  employeeId: string,
  correspondenceId: string,
  responseId: string,
): { viewHref: string; downloadHref: string } {
  const base = `/people/employees/${employeeId}/documents/${correspondenceId}/responses/${responseId}/attachment`;
  return {
    viewHref: `${base}?disposition=inline`,
    downloadHref: `${base}?disposition=attachment`,
  };
}

function attachmentUrls(
  employeeId: string,
  correspondenceId: string,
  attachmentId: string,
): { viewHref: string; downloadHref: string } {
  const base = `/people/employees/${employeeId}/documents/${correspondenceId}/attachments/${attachmentId}`;
  return {
    viewHref: `${base}?disposition=inline`,
    downloadHref: `${base}?disposition=attachment`,
  };
}

function mapListItem(
  record: {
    id: string;
    category: string;
    subType: string | null;
    title: string;
    status: string;
    employeeVisible: boolean;
    managerVisible: boolean;
    requiresAcknowledgement: boolean;
    allowsEmployeeResponse: boolean;
    effectiveDate: Date;
    issueDate: Date | null;
    retentionUntil: Date | null;
    issuedBy: { firstName: string; lastName: string } | null;
    _count: { attachments: number };
  },
  options?: { forSelfService?: boolean },
): CorrespondenceListItem {
  const status = record.status as CorrespondenceListItem["status"];
  const canAcknowledge = canEmployeeAcknowledgeCorrespondence({
    status: status as "DRAFT" | "ISSUED" | "ACKNOWLEDGED" | "ARCHIVED" | "SUPERSEDED",
    employeeVisible: record.employeeVisible,
    requiresAcknowledgement: record.requiresAcknowledgement,
  });

  return {
    id: record.id,
    category: record.category,
    subType: record.subType,
    title: record.title,
    status: record.status,
    employeeVisible: record.employeeVisible,
    managerVisible: record.managerVisible,
    requiresAcknowledgement: record.requiresAcknowledgement,
    allowsEmployeeResponse: record.allowsEmployeeResponse,
    effectiveDate: formatDate(record.effectiveDate)!,
    issueDate: formatDate(record.issueDate),
    retentionUntil: formatDate(record.retentionUntil),
    attachmentCount: record._count.attachments,
    issuedByName: userDisplayName(record.issuedBy),
    canAcknowledge: options?.forSelfService ? canAcknowledge : false,
    isAckOverdue: isAcknowledgementOverdue({
      status: status as "DRAFT" | "ISSUED" | "ACKNOWLEDGED" | "ARCHIVED" | "SUPERSEDED",
      requiresAcknowledgement: record.requiresAcknowledgement,
      issueDate: record.issueDate,
    }),
  };
}

function buildCorrespondenceWhere(
  employeeId: string,
  filters?: CorrespondenceListFilters,
  options?: { selfServiceOnly?: boolean; managerView?: boolean },
): Prisma.EmployeeCorrespondenceWhereInput {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const retentionWindow = new Date(today);
  retentionWindow.setUTCDate(retentionWindow.getUTCDate() + 30);

  const where: Prisma.EmployeeCorrespondenceWhereInput = {
    employeeId,
    ...(options?.selfServiceOnly
      ? {
          employeeVisible: true,
          status: { in: ["ISSUED", "ACKNOWLEDGED"] },
        }
      : {}),
    ...(options?.managerView
      ? {
          managerVisible: true,
          status: { in: ["ISSUED", "ACKNOWLEDGED"] },
        }
      : {}),
    ...(filters?.category ? { category: filters.category as never } : {}),
    ...(filters?.status ? { status: filters.status as never } : {}),
    ...(filters?.subType
      ? { subType: { equals: filters.subType, mode: "insensitive" } }
      : {}),
    ...(filters?.overdueAck
      ? {
          status: "ISSUED",
          requiresAcknowledgement: true,
          issueDate: {
            not: null,
            lt: new Date(
              today.getTime() -
                7 * 24 * 60 * 60 * 1000,
            ),
          },
        }
      : {}),
    ...(filters?.expiringRetention
      ? {
          retentionUntil: {
            not: null,
            gte: today,
            lte: retentionWindow,
          },
          status: { in: ["ISSUED", "ACKNOWLEDGED"] },
        }
      : {}),
  };

  return where;
}

const listSelect = {
  id: true,
  category: true,
  subType: true,
  title: true,
  status: true,
  employeeVisible: true,
  managerVisible: true,
  requiresAcknowledgement: true,
  allowsEmployeeResponse: true,
  effectiveDate: true,
  issueDate: true,
  retentionUntil: true,
  issuedBy: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  _count: {
    select: {
      attachments: true,
    },
  },
} as const;

export async function getEmployeeCorrespondenceList(
  employeeId: string,
  options?: {
    selfServiceOnly?: boolean;
    managerView?: boolean;
    filters?: CorrespondenceListFilters;
  },
): Promise<EmployeeCorrespondenceList | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    return null;
  }

  const records = await prisma.employeeCorrespondence.findMany({
    where: buildCorrespondenceWhere(employeeId, options?.filters, options),
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: listSelect,
  });

  const items = records
    .filter((record) => {
      if (options?.selfServiceOnly) {
        return isEmployeeVisibleCorrespondence(record);
      }

      // managerView is applied in Prisma via buildCorrespondenceWhere
      return true;
    })
    .map((record) =>
      mapListItem(record, { forSelfService: options?.selfServiceOnly }),
    );

  return {
    employee,
    items,
    pendingAcknowledgementCount: items.filter((item) => item.canAcknowledge)
      .length,
    overdueAcknowledgementCount: items.filter((item) => item.isAckOverdue)
      .length,
  };
}

async function buildSupersessionChain(
  record: {
    id: string;
    supersedesId: string | null;
    supersededBy: { id: string } | null;
  },
  employeeId: string,
): Promise<CorrespondenceChainItem[]> {
  // Bulk-load the employee's supersession edges once, then walk in memory.
  const edges = await prisma.employeeCorrespondence.findMany({
    where: { employeeId },
    select: {
      id: true,
      supersedesId: true,
      title: true,
      status: true,
      issueDate: true,
      effectiveDate: true,
      createdAt: true,
      supersededBy: { select: { id: true } },
    },
  });

  const byId = new Map(edges.map((row) => [row.id, row]));
  const chainIds = new Set<string>();

  let cursorId: string | null = record.supersedesId;
  while (cursorId) {
    if (chainIds.has(cursorId)) {
      break;
    }
    chainIds.add(cursorId);
    cursorId = byId.get(cursorId)?.supersedesId ?? null;
  }

  cursorId = record.supersededBy?.id ?? null;
  while (cursorId) {
    if (chainIds.has(cursorId)) {
      break;
    }
    chainIds.add(cursorId);
    cursorId = byId.get(cursorId)?.supersededBy?.id ?? null;
  }

  if (chainIds.size === 0) {
    return [];
  }

  return [...chainIds]
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aDate = a.effectiveDate?.getTime() ?? a.createdAt.getTime();
      const bDate = b.effectiveDate?.getTime() ?? b.createdAt.getTime();
      return aDate - bDate;
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      issueDate: formatDate(item.issueDate),
      effectiveDate: formatDate(item.effectiveDate)!,
    }));
}

async function loadRelatedLetters(
  employeeId: string,
  correspondenceId: string,
  relatedCorrespondenceId: string | null,
): Promise<CorrespondenceChainItem[]> {
  const relatedIds = new Set<string>();

  if (relatedCorrespondenceId) {
    relatedIds.add(relatedCorrespondenceId);
  }

  const linkedFrom = await prisma.employeeCorrespondence.findMany({
    where: {
      employeeId,
      relatedCorrespondenceId: correspondenceId,
    },
    select: { id: true },
  });

  for (const item of linkedFrom) {
    relatedIds.add(item.id);
  }

  relatedIds.delete(correspondenceId);

  if (relatedIds.size === 0) {
    return [];
  }

  const records = await prisma.employeeCorrespondence.findMany({
    where: {
      employeeId,
      id: { in: [...relatedIds] },
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      issueDate: true,
      effectiveDate: true,
    },
  });

  return records.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    issueDate: formatDate(item.issueDate),
    effectiveDate: formatDate(item.effectiveDate)!,
  }));
}

export async function getCorrespondenceDetail(
  employeeId: string,
  correspondenceId: string,
  options?: { selfServiceOnly?: boolean; managerView?: boolean },
): Promise<CorrespondenceDetail | null> {
  const record = await prisma.employeeCorrespondence.findFirst({
    where: {
      id: correspondenceId,
      employeeId,
    },
    select: {
      ...listSelect,
      body: true,
      acknowledgedAt: true,
      supersedesId: true,
      relatedCorrespondenceId: true,
      templateId: true,
      createdAt: true,
      updatedAt: true,
      acknowledgedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      supersededBy: { select: { id: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      attachments: {
        orderBy: { uploadedAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
        },
      },
      responses: {
        select: {
          id: true,
          body: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewNote: true,
          fileName: true,
          reviewedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!record) {
    return null;
  }

  if (
    options?.selfServiceOnly &&
    !isEmployeeVisibleCorrespondence(record)
  ) {
    return null;
  }

  if (
    options?.managerView &&
  !(
      record.managerVisible &&
      (record.status === "ISSUED" || record.status === "ACKNOWLEDGED")
    )
  ) {
    return null;
  }

  const listItem = mapListItem(record, {
    forSelfService: options?.selfServiceOnly,
  });

  const [chain, relatedLetters] = await Promise.all([
    buildSupersessionChain(record, employeeId),
    loadRelatedLetters(
      employeeId,
      correspondenceId,
      record.relatedCorrespondenceId,
    ),
  ]);

  const alreadyHasAssumption = relatedLetters.some((item) =>
    /assumption[\s_-]+of[\s_-]+duty/i.test(item.title),
  );

  const canIssueAssumptionOfDuty =
    record.category === "OFFER_LETTER" &&
    (record.status === "ISSUED" || record.status === "ACKNOWLEDGED") &&
    !alreadyHasAssumption;

  const responseRecord = record.responses[0] ?? null;
  const employeeResponse = responseRecord
    ? {
        id: responseRecord.id,
        body: responseRecord.body,
        status: responseRecord.status,
        submittedAt: responseRecord.submittedAt.toISOString(),
        reviewedAt: responseRecord.reviewedAt?.toISOString() ?? null,
        reviewedByName: userDisplayName(responseRecord.reviewedBy),
        reviewNote: responseRecord.reviewNote,
        attachment: responseRecord.fileName
          ? {
              fileName: responseRecord.fileName,
              ...responseAttachmentUrls(
                employeeId,
                correspondenceId,
                responseRecord.id,
              ),
            }
          : null,
      }
    : null;

  const canSubmitResponse =
    !!options?.selfServiceOnly &&
    canEmployeeSubmitCorrespondenceResponse(
      {
        status: record.status as "DRAFT" | "ISSUED" | "ACKNOWLEDGED" | "ARCHIVED" | "SUPERSEDED",
        employeeVisible: record.employeeVisible,
        allowsEmployeeResponse: record.allowsEmployeeResponse,
      },
      responseRecord,
    );

  const canUpdateResponse =
    !!options?.selfServiceOnly &&
    canEmployeeUpdateCorrespondenceResponse(responseRecord);

  const canReviewResponse =
    !options?.selfServiceOnly &&
    canHrReviewCorrespondenceResponse(responseRecord);

  return {
    ...listItem,
    body: record.body,
    acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByName: userDisplayName(record.acknowledgedBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    supersedesId: record.supersedesId,
    supersededById: record.supersededBy?.id ?? null,
    templateId: record.templateId,
    relatedCorrespondenceId: record.relatedCorrespondenceId,
    relatedLetters,
    canIssueAssumptionOfDuty,
    canSubmitResponse,
    canUpdateResponse,
    canReviewResponse,
    employeeResponse,
    attachments: record.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      ...attachmentUrls(employeeId, correspondenceId, attachment.id),
    })),
    chain,
    employee: record.employee,
  };
}

export async function countPendingCorrespondenceAcknowledgements(
  employeeId: string,
): Promise<number> {
  return prisma.employeeCorrespondence.count({
    where: {
      employeeId,
      employeeVisible: true,
      requiresAcknowledgement: true,
      status: "ISSUED",
    },
  });
}
