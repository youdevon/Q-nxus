import { prisma } from "@/lib/prisma";

import { looksLikeOpaqueId } from "@/src/lib/audit-display";

export type AuditEntityRef = {
  entityType: string;
  entityId: string;
};

const PERSON_FIELDS = {
  firstName: true,
  lastName: true,
} as const;

function personLabel(person: {
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
}): string {
  const name = `${person.firstName} ${person.lastName}`.trim();
  if (person.employeeNumber) {
    return `${person.employeeNumber} — ${name}`;
  }
  return name;
}

function collectIds(
  values: unknown,
  fieldToType: Record<string, string>,
  into: Map<string, Set<string>>,
): void {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return;
  }

  for (const [field, raw] of Object.entries(values as Record<string, unknown>)) {
    const entityType = fieldToType[field];
    if (!entityType || typeof raw !== "string" || !looksLikeOpaqueId(raw)) {
      continue;
    }

    const bucket = into.get(entityType) ?? new Set<string>();
    bucket.add(raw);
    into.set(entityType, bucket);
  }
}

/** Known foreign-key fields stored in audit old/new JSON. */
const REFERENCE_FIELD_TYPES: Record<string, string> = {
  userId: "User",
  roleId: "Role",
  employeeId: "Employee",
  departmentId: "Department",
  positionId: "Position",
  reportingToPositionId: "Position",
  organizationId: "Organization",
  businessUnitId: "BusinessUnit",
  locationId: "Location",
  leaveTypeId: "LeaveType",
  contractId: "EmploymentContract",
  payRunId: "PayRun",
  sourcePayRunId: "PayRun",
  payslipId: "Payslip",
  templateId: "CorrespondenceTemplate",
  jobDescriptionId: "PositionJobDescription",
  sourcePositionId: "Position",
};

/**
 * Resolve human-readable labels for audit entity refs and common FK values
 * found in change payloads. Returns a map keyed by entity id.
 */
export async function resolveAuditLabels(input: {
  entityRefs: AuditEntityRef[];
  changeValues: unknown[];
}): Promise<Map<string, string>> {
  const byType = new Map<string, Set<string>>();

  for (const ref of input.entityRefs) {
    if (!ref.entityId || !ref.entityType) {
      continue;
    }

    // Domain settings and similar may use codes rather than CUIDs.
    const bucket = byType.get(ref.entityType) ?? new Set<string>();
    bucket.add(ref.entityId);
    byType.set(ref.entityType, bucket);
  }

  for (const values of input.changeValues) {
    collectIds(values, REFERENCE_FIELD_TYPES, byType);
  }

  const labels = new Map<string, string>();

  const ids = (type: string) => Array.from(byType.get(type) ?? []);

  const [
    employees,
    users,
    roles,
    organizations,
    departments,
    positions,
    businessUnits,
    locations,
    leaveTypes,
    leaveRequests,
    contracts,
    payRuns,
    payslips,
    payrollProfiles,
    correspondences,
    correspondenceTemplates,
    credentials,
    training,
    qualifications,
    appraisals,
    assignments,
    userRoles,
    numberingSequences,
    allowanceCategories,
    jobDescriptions,
  ] = await Promise.all([
    ids("Employee").length
      ? prisma.employee.findMany({
          where: { id: { in: ids("Employee") } },
          select: {
            id: true,
            employeeNumber: true,
            ...PERSON_FIELDS,
          },
        })
      : Promise.resolve([]),
    ids("User").length
      ? prisma.user.findMany({
          where: { id: { in: ids("User") } },
          select: { id: true, ...PERSON_FIELDS },
        })
      : Promise.resolve([]),
    ids("Role").length
      ? prisma.role.findMany({
          where: { id: { in: ids("Role") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("Organization").length || ids("DemoData").length
      ? prisma.organization.findMany({
          where: {
            id: {
              in: [...ids("Organization"), ...ids("DemoData")],
            },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("Department").length
      ? prisma.department.findMany({
          where: { id: { in: ids("Department") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("Position").length
      ? prisma.position.findMany({
          where: { id: { in: ids("Position") } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    ids("BusinessUnit").length
      ? prisma.businessUnit.findMany({
          where: { id: { in: ids("BusinessUnit") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("Location").length
      ? prisma.location.findMany({
          where: { id: { in: ids("Location") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("LeaveType").length
      ? prisma.leaveType.findMany({
          where: { id: { in: ids("LeaveType") } },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
    ids("LeaveRequest").length
      ? prisma.leaveRequest.findMany({
          where: { id: { in: ids("LeaveRequest") } },
          select: {
            id: true,
            requestNumber: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("EmploymentContract").length
      ? prisma.employmentContract.findMany({
          where: { id: { in: ids("EmploymentContract") } },
          select: {
            id: true,
            contractNumber: true,
            jobTitle: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("PayRun").length
      ? prisma.payRun.findMany({
          where: { id: { in: ids("PayRun") } },
          select: { id: true, runNumber: true },
        })
      : Promise.resolve([]),
    ids("Payslip").length
      ? prisma.payslip.findMany({
          where: { id: { in: ids("Payslip") } },
          select: {
            id: true,
            employeeName: true,
            employeeNumber: true,
          },
        })
      : Promise.resolve([]),
    ids("PayrollProfile").length
      ? prisma.payrollProfile.findMany({
          where: { id: { in: ids("PayrollProfile") } },
          select: {
            id: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("EmployeeCorrespondence").length
      ? prisma.employeeCorrespondence.findMany({
          where: { id: { in: ids("EmployeeCorrespondence") } },
          select: {
            id: true,
            title: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("CorrespondenceTemplate").length
      ? prisma.correspondenceTemplate.findMany({
          where: { id: { in: ids("CorrespondenceTemplate") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("EmployeeCredential").length
      ? prisma.employeeCredential.findMany({
          where: { id: { in: ids("EmployeeCredential") } },
          select: {
            id: true,
            name: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("EmployeeTrainingRecord").length
      ? prisma.employeeTrainingRecord.findMany({
          where: { id: { in: ids("EmployeeTrainingRecord") } },
          select: {
            id: true,
            courseName: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("EmployeeQualificationDocument").length
      ? prisma.employeeQualificationDocument.findMany({
          where: { id: { in: ids("EmployeeQualificationDocument") } },
          select: {
            id: true,
            title: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("PerformanceAppraisal").length
      ? prisma.performanceAppraisal.findMany({
          where: { id: { in: ids("PerformanceAppraisal") } },
          select: {
            id: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
          },
        })
      : Promise.resolve([]),
    ids("EmployeeAssignment").length
      ? prisma.employeeAssignment.findMany({
          where: { id: { in: ids("EmployeeAssignment") } },
          select: {
            id: true,
            employee: {
              select: { employeeNumber: true, ...PERSON_FIELDS },
            },
            position: { select: { title: true } },
            department: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    ids("UserRole").length
      ? prisma.userRole.findMany({
          where: { id: { in: ids("UserRole") } },
          select: {
            id: true,
            user: { select: PERSON_FIELDS },
            role: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    ids("NumberingSequence").length
      ? prisma.numberingSequence.findMany({
          where: { id: { in: ids("NumberingSequence") } },
          select: { id: true, sequenceCode: true },
        })
      : Promise.resolve([]),
    ids("AllowanceCategory").length
      ? prisma.allowanceCategory.findMany({
          where: { id: { in: ids("AllowanceCategory") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids("PositionJobDescription").length || ids("JobDescription").length
      ? prisma.positionJobDescription.findMany({
          where: {
            id: {
              in: [
                ...ids("PositionJobDescription"),
                ...ids("JobDescription"),
              ],
            },
          },
          select: {
            id: true,
            title: true,
            versionNumber: true,
            position: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  for (const row of employees) {
    labels.set(row.id, personLabel(row));
  }
  for (const row of users) {
    labels.set(row.id, personLabel(row));
  }
  for (const row of roles) {
    labels.set(row.id, row.name);
  }
  for (const row of organizations) {
    labels.set(row.id, row.name);
  }
  for (const row of departments) {
    labels.set(row.id, row.name);
  }
  for (const row of positions) {
    labels.set(row.id, row.title);
  }
  for (const row of businessUnits) {
    labels.set(row.id, row.name);
  }
  for (const row of locations) {
    labels.set(row.id, row.name);
  }
  for (const row of leaveTypes) {
    labels.set(row.id, row.name || row.code);
  }
  for (const row of leaveRequests) {
    labels.set(
      row.id,
      row.requestNumber?.trim() ||
        `Leave for ${personLabel(row.employee)}`,
    );
  }
  for (const row of contracts) {
    const employee = personLabel(row.employee);
    labels.set(
      row.id,
      row.contractNumber?.trim()
        ? `${row.contractNumber} — ${employee}`
        : `${row.jobTitle} — ${employee}`,
    );
  }
  for (const row of payRuns) {
    labels.set(row.id, row.runNumber);
  }
  for (const row of payslips) {
    labels.set(row.id, `${row.employeeNumber} — ${row.employeeName}`);
  }
  for (const row of payrollProfiles) {
    labels.set(row.id, personLabel(row.employee));
  }
  for (const row of correspondences) {
    labels.set(
      row.id,
      `“${row.title}” — ${personLabel(row.employee)}`,
    );
  }
  for (const row of correspondenceTemplates) {
    labels.set(row.id, row.name);
  }
  for (const row of credentials) {
    labels.set(
      row.id,
      `“${row.name}” — ${personLabel(row.employee)}`,
    );
  }
  for (const row of training) {
    labels.set(
      row.id,
      `“${row.courseName}” — ${personLabel(row.employee)}`,
    );
  }
  for (const row of qualifications) {
    labels.set(
      row.id,
      `“${row.title}” — ${personLabel(row.employee)}`,
    );
  }
  for (const row of appraisals) {
    labels.set(row.id, personLabel(row.employee));
  }
  for (const row of assignments) {
    const target = row.position?.title ?? row.department.name;
    labels.set(row.id, `${personLabel(row.employee)} → ${target}`);
  }
  for (const row of userRoles) {
    labels.set(
      row.id,
      `${row.role.name} → ${personLabel(row.user)}`,
    );
  }
  for (const row of numberingSequences) {
    labels.set(row.id, row.sequenceCode);
  }
  for (const row of allowanceCategories) {
    labels.set(row.id, row.name);
  }
  for (const row of jobDescriptions) {
    labels.set(
      row.id,
      `${row.title || row.position.title} (v${row.versionNumber})`,
    );
  }

  // Non-CUID domain setting codes: use a friendly label for known codes.
  for (const id of ids("DomainSetting")) {
    if (!labels.has(id)) {
      if (id === "leave.workflow" || id.includes("leave") || id.includes("LEAVE")) {
        labels.set(id, "Leave workflow settings");
      } else {
        labels.set(id, id.replaceAll(/[._-]+/g, " ").trim());
      }
    }
  }

  return labels;
}
