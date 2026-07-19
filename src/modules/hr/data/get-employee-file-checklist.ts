import { prisma } from "@/lib/prisma";
import {
  type ChecklistCompletenessSummary,
  type EmployeeFileChecklistItemType,
  type ResolvedChecklistItem,
  resolveEmployeeFileChecklist,
  summarizeChecklistCompleteness,
} from "@/src/modules/hr/lib/employee-file-checklist";

export type EmployeeFileChecklistView = {
  employeeId: string;
  items: Array<
    ResolvedChecklistItem & {
      downloadHref: string | null;
      linkedHref: string | null;
    }
  >;
  /** Satisfied items including N/A. */
  completeCount: number;
  /** All checklist slots (N/A included in the denominator). */
  totalCount: number;
  /** @deprecated Prefer totalCount — N/A now counts as satisfied. */
  totalApplicableCount: number;
  percentComplete: number;
  isComplete: boolean;
  missingLabels: string[];
  completeness: ChecklistCompletenessSummary;
};

function checklistDownloadHref(
  employeeId: string,
  itemType: EmployeeFileChecklistItemType,
  options: {
    hasDirectAttachment: boolean;
    credentialId: string | null;
    qualificationDocumentId: string | null;
  },
): string | null {
  if (options.hasDirectAttachment) {
    return `/people/employees/${employeeId}/documents/checklist/${itemType}/file`;
  }

  if (options.credentialId) {
    return `/people/employees/${employeeId}/credentials/${options.credentialId}/attachment`;
  }

  if (options.qualificationDocumentId) {
    return `/people/employees/${employeeId}/qualifications/${options.qualificationDocumentId}/file`;
  }

  return null;
}

function checklistLinkedHref(
  employeeId: string,
  item: ResolvedChecklistItem,
  options?: { selfServiceOnly?: boolean },
): string | null {
  if (item.correspondenceId) {
    return options?.selfServiceOnly
      ? `/me/documents/${item.correspondenceId}`
      : `/people/employees/${employeeId}/documents/${item.correspondenceId}`;
  }

  if (options?.selfServiceOnly) {
    return null;
  }

  if (item.qualificationDocumentId) {
    return `/people/employees/${employeeId}/qualifications/${item.qualificationDocumentId}/edit`;
  }

  if (item.credentialId) {
    return `/people/employees/${employeeId}/credentials/${item.credentialId}/edit`;
  }

  return null;
}

export async function getEmployeeFileChecklist(
  employeeId: string,
  options?: { selfServiceOnly?: boolean },
): Promise<EmployeeFileChecklistView | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  if (!employee) {
    return null;
  }

  const visibilityFilter = options?.selfServiceOnly
    ? { employeeVisible: true }
    : {};

  const [overrides, qualifications, credentials, correspondences] =
    await Promise.all([
      prisma.employeeFileChecklistItem.findMany({
        where: {
          employeeId,
          ...(options?.selfServiceOnly ? { employeeVisible: true } : {}),
        },
        select: {
          itemType: true,
          notApplicable: true,
          notes: true,
          qualificationDocumentId: true,
          credentialId: true,
          correspondenceId: true,
          fileName: true,
          storageKey: true,
          employeeVisible: true,
          assumptionOfDutySignedAt: true,
        },
      }),
      prisma.employeeQualificationDocument.findMany({
        where: { employeeId, ...visibilityFilter },
        select: {
          id: true,
          title: true,
          storageKey: true,
          employeeVisible: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employeeCredential.findMany({
        where: { employeeId, ...visibilityFilter },
        select: {
          id: true,
          name: true,
          storageKey: true,
          employeeVisible: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employeeCorrespondence.findMany({
        where: {
          employeeId,
          ...(options?.selfServiceOnly
            ? {
                employeeVisible: true,
                status: { in: ["ISSUED", "ACKNOWLEDGED"] },
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          subType: true,
          status: true,
          requiresAcknowledgement: true,
          acknowledgedAt: true,
          employeeVisible: true,
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  const resolved = resolveEmployeeFileChecklist({
    overrides,
    qualifications: qualifications.map((item) => ({
      id: item.id,
      title: item.title,
      hasAttachment: Boolean(item.storageKey),
      employeeVisible: item.employeeVisible,
    })),
    credentials: credentials.map((item) => ({
      id: item.id,
      name: item.name,
      hasAttachment: Boolean(item.storageKey),
      employeeVisible: item.employeeVisible,
    })),
    correspondences,
    selfServiceOnly: options?.selfServiceOnly,
  });

  const items = resolved.map((item) => {
    const downloadHref = checklistDownloadHref(employeeId, item.itemType, {
      hasDirectAttachment: item.sourceKind === "attachment",
      credentialId:
        item.sourceKind === "credential" && item.hasDirectAttachment
          ? item.credentialId
          : null,
      qualificationDocumentId:
        item.sourceKind === "qualification" && item.hasDirectAttachment
          ? item.qualificationDocumentId
          : null,
    });

    return {
      ...item,
      downloadHref,
      linkedHref: checklistLinkedHref(employeeId, item, options),
    };
  });

  const completeness = summarizeChecklistCompleteness(items);

  return {
    employeeId,
    items,
    completeCount: completeness.completeCount,
    totalCount: completeness.totalCount,
    totalApplicableCount: completeness.totalCount,
    percentComplete: completeness.percentComplete,
    isComplete: completeness.isComplete,
    missingLabels: completeness.missingLabels,
    completeness,
  };
}
