import { prisma } from "@/lib/prisma";
import {
  type ChecklistCompletenessSummary,
  type EmployeeFileChecklistItemType,
  resolveEmployeeFileChecklist,
  summarizeChecklistCompleteness,
} from "@/src/modules/hr/lib/employee-file-checklist";

export type EmployeeFileCompletenessRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentId: string | null;
  departmentName: string | null;
  completeness: ChecklistCompletenessSummary;
};

/**
 * Org-wide checklist completeness for active employees.
 * Used by missing-docs report and soft payroll warnings.
 *
 * Pass `mode: "summary"` for soft warnings — loads assumption-of-duty
 * correspondence only (plus override-pinned ids), not every letter body.
 */
export async function getOrgEmployeeFileCompleteness(options?: {
  organizationId?: string;
  departmentId?: string | null;
  itemType?: EmployeeFileChecklistItemType | null;
  incompleteOnly?: boolean;
  mode?: "full" | "summary";
  /** When provided, skip the employee directory query (shared with payroll readiness). */
  employees?: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    departmentId: string | null;
    departmentName: string | null;
  }>;
}): Promise<EmployeeFileCompletenessRow[]> {
  const mode = options?.mode ?? "full";

  const employees =
    options?.employees ??
    (
      await prisma.employee.findMany({
        where: {
          isArchived: false,
          employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
          // Non-employee payees do not maintain employee files.
          workforceCategory: "EMPLOYEE",
          ...(options?.organizationId
            ? { organizationId: options.organizationId }
            : {}),
          ...(options?.departmentId
            ? { departmentId: options.departmentId }
            : {}),
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      })
    ).map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
    }));

  if (employees.length === 0) {
    return [];
  }

  const employeeIds = employees.map((employee) => employee.id);

  const [overrides, qualifications, credentials] = await Promise.all([
    prisma.employeeFileChecklistItem.findMany({
      where: { employeeId: { in: employeeIds } },
      select: {
        employeeId: true,
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
      where: { employeeId: { in: employeeIds } },
      select: {
        id: true,
        employeeId: true,
        title: true,
        storageKey: true,
        employeeVisible: true,
      },
    }),
    prisma.employeeCredential.findMany({
      where: { employeeId: { in: employeeIds } },
      select: {
        id: true,
        employeeId: true,
        name: true,
        storageKey: true,
        employeeVisible: true,
      },
    }),
  ]);

  const pinnedCorrespondenceIds = [
    ...new Set(
      overrides
        .map((row) => row.correspondenceId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const correspondences = await prisma.employeeCorrespondence.findMany({
    where: {
      employeeId: { in: employeeIds },
      ...(mode === "summary"
        ? {
            OR: [
              ...(pinnedCorrespondenceIds.length > 0
                ? [{ id: { in: pinnedCorrespondenceIds } }]
                : []),
              { title: { contains: "assumption", mode: "insensitive" } },
              { subType: { contains: "assumption", mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      employeeId: true,
      title: true,
      subType: true,
      status: true,
      requiresAcknowledgement: true,
      acknowledgedAt: true,
      employeeVisible: true,
    },
  });

  const overridesByEmployee = groupBy(overrides, (row) => row.employeeId);
  const qualsByEmployee = groupBy(qualifications, (row) => row.employeeId);
  const credsByEmployee = groupBy(credentials, (row) => row.employeeId);
  const lettersByEmployee = groupBy(correspondences, (row) => row.employeeId);

  const rows: EmployeeFileCompletenessRow[] = employees.map((employee) => {
    const resolved = resolveEmployeeFileChecklist({
      overrides: (overridesByEmployee.get(employee.id) ?? []).map((row) => ({
        itemType: row.itemType,
        notApplicable: row.notApplicable,
        notes: row.notes,
        qualificationDocumentId: row.qualificationDocumentId,
        credentialId: row.credentialId,
        correspondenceId: row.correspondenceId,
        fileName: row.fileName,
        storageKey: row.storageKey,
        employeeVisible: row.employeeVisible,
        assumptionOfDutySignedAt: row.assumptionOfDutySignedAt,
      })),
      qualifications: (qualsByEmployee.get(employee.id) ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        hasAttachment: Boolean(row.storageKey),
        employeeVisible: row.employeeVisible,
      })),
      credentials: (credsByEmployee.get(employee.id) ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        hasAttachment: Boolean(row.storageKey),
        employeeVisible: row.employeeVisible,
      })),
      correspondences: lettersByEmployee.get(employee.id) ?? [],
    });

    const completeness = summarizeChecklistCompleteness(resolved);

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      departmentId: employee.departmentId,
      departmentName: employee.departmentName,
      completeness,
    };
  });

  let filtered = rows;

  if (options?.incompleteOnly) {
    filtered = filtered.filter((row) => !row.completeness.isComplete);
  }

  if (options?.itemType) {
    const itemType = options.itemType;
    filtered = filtered.filter((row) =>
      row.completeness.missingItemTypes.includes(itemType),
    );
  }

  return filtered;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const existing = map.get(groupKey);
    if (existing) {
      existing.push(item);
    } else {
      map.set(groupKey, [item]);
    }
  }
  return map;
}
