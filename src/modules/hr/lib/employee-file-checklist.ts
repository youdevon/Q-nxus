/**
 * Pure helpers for the standard employee-file document checklist.
 * Status is derived from linked modules + optional per-employee overrides.
 */

export const EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES = [
  "ACADEMIC_CERTIFICATES",
  "COPY_OF_ID",
  "BIRTH_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "ASSUMPTION_OF_DUTY",
] as const;

export type EmployeeFileChecklistItemType =
  (typeof EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES)[number];

export type EmployeeFileChecklistStatus =
  | "MISSING"
  | "UPLOADED"
  | "NOT_APPLICABLE"
  | "SIGNED"
  | "PENDING";

export type ChecklistSourceKind =
  | "qualification"
  | "credential"
  | "correspondence"
  | "attachment"
  | "manual";

export type ChecklistQualificationCandidate = {
  id: string;
  title: string;
  hasAttachment: boolean;
  employeeVisible: boolean;
};

export type ChecklistCredentialCandidate = {
  id: string;
  name: string;
  hasAttachment: boolean;
  employeeVisible: boolean;
};

export type ChecklistCorrespondenceCandidate = {
  id: string;
  title: string;
  subType: string | null;
  status: string;
  requiresAcknowledgement: boolean;
  acknowledgedAt: Date | string | null;
  employeeVisible: boolean;
};

export type ChecklistOverrideRow = {
  itemType: EmployeeFileChecklistItemType;
  notApplicable: boolean;
  notes: string | null;
  qualificationDocumentId: string | null;
  credentialId: string | null;
  correspondenceId: string | null;
  fileName: string | null;
  storageKey: string | null;
  employeeVisible: boolean;
  assumptionOfDutySignedAt: Date | string | null;
};

const ID_NAME_PATTERN =
  /\b(id|passport|national\s*id|identification|driver'?s?\s*licen[cs]e)\b/i;
const BIRTH_NAME_PATTERN = /birth\s*cert/i;
const MARRIAGE_NAME_PATTERN = /marriage\s*cert/i;
const ASSUMPTION_PATTERN = /assumption[\s_-]+of[\s_-]+duty/i;

export function checklistItemLabel(
  itemType: EmployeeFileChecklistItemType,
): string {
  switch (itemType) {
    case "ACADEMIC_CERTIFICATES":
      return "Academic Certificates";
    case "COPY_OF_ID":
      return "Copy of your ID";
    case "BIRTH_CERTIFICATE":
      return "Copy of Birth Certificate";
    case "MARRIAGE_CERTIFICATE":
      return "Copy of Marriage Certificate (If Applicable)";
    case "ASSUMPTION_OF_DUTY":
      return "Signed Assumption of Duty forms";
  }
}

export function checklistCredentialDefaultName(
  itemType: Extract<
    EmployeeFileChecklistItemType,
    "COPY_OF_ID" | "BIRTH_CERTIFICATE" | "MARRIAGE_CERTIFICATE"
  >,
): string {
  switch (itemType) {
    case "COPY_OF_ID":
      return "Copy of ID";
    case "BIRTH_CERTIFICATE":
      return "Birth Certificate";
    case "MARRIAGE_CERTIFICATE":
      return "Marriage Certificate";
  }
}

export function matchesCredentialForChecklistItem(
  itemType: EmployeeFileChecklistItemType,
  name: string,
): boolean {
  switch (itemType) {
    case "COPY_OF_ID":
      return ID_NAME_PATTERN.test(name);
    case "BIRTH_CERTIFICATE":
      return BIRTH_NAME_PATTERN.test(name);
    case "MARRIAGE_CERTIFICATE":
      return MARRIAGE_NAME_PATTERN.test(name);
    default:
      return false;
  }
}

export function matchesAssumptionOfDutyCorrespondence(input: {
  title: string;
  subType: string | null;
}): boolean {
  return (
    ASSUMPTION_PATTERN.test(input.title) ||
    (input.subType != null && ASSUMPTION_PATTERN.test(input.subType))
  );
}

export function allowsNotApplicable(
  itemType: EmployeeFileChecklistItemType,
): boolean {
  return (
    itemType === "MARRIAGE_CERTIFICATE" || itemType === "ASSUMPTION_OF_DUTY"
  );
}

export function supportsCredentialUpload(
  itemType: EmployeeFileChecklistItemType,
): itemType is "COPY_OF_ID" | "BIRTH_CERTIFICATE" | "MARRIAGE_CERTIFICATE" {
  return (
    itemType === "COPY_OF_ID" ||
    itemType === "BIRTH_CERTIFICATE" ||
    itemType === "MARRIAGE_CERTIFICATE"
  );
}

function pickQualification(
  override: ChecklistOverrideRow | undefined,
  qualifications: ChecklistQualificationCandidate[],
): ChecklistQualificationCandidate | null {
  if (override?.qualificationDocumentId) {
    const pinned = qualifications.find(
      (item) => item.id === override.qualificationDocumentId,
    );
    if (pinned) {
      return pinned;
    }
  }

  const withFile = qualifications.find((item) => item.hasAttachment);
  return withFile ?? qualifications[0] ?? null;
}

function pickCredential(
  itemType: EmployeeFileChecklistItemType,
  override: ChecklistOverrideRow | undefined,
  credentials: ChecklistCredentialCandidate[],
): ChecklistCredentialCandidate | null {
  if (override?.credentialId) {
    const pinned = credentials.find((item) => item.id === override.credentialId);
    if (pinned) {
      return pinned;
    }
  }

  const matches = credentials.filter((item) =>
    matchesCredentialForChecklistItem(itemType, item.name),
  );
  const withFile = matches.find((item) => item.hasAttachment);
  return withFile ?? matches[0] ?? null;
}

function pickCorrespondence(
  override: ChecklistOverrideRow | undefined,
  correspondences: ChecklistCorrespondenceCandidate[],
): ChecklistCorrespondenceCandidate | null {
  if (override?.correspondenceId) {
    const pinned = correspondences.find(
      (item) => item.id === override.correspondenceId,
    );
    if (pinned) {
      return pinned;
    }
  }

  const matches = correspondences.filter((item) =>
    matchesAssumptionOfDutyCorrespondence(item),
  );

  const acknowledged = matches.find(
    (item) => item.status === "ACKNOWLEDGED" || item.acknowledgedAt,
  );
  if (acknowledged) {
    return acknowledged;
  }

  const issued = matches.find(
    (item) => item.status === "ISSUED" || item.status === "ACKNOWLEDGED",
  );
  return issued ?? matches[0] ?? null;
}

export type ResolvedChecklistItem = {
  itemType: EmployeeFileChecklistItemType;
  label: string;
  status: EmployeeFileChecklistStatus;
  allowsNotApplicable: boolean;
  notApplicable: boolean;
  notes: string | null;
  employeeVisible: boolean;
  sourceKind: ChecklistSourceKind | null;
  linkedLabel: string | null;
  qualificationDocumentId: string | null;
  credentialId: string | null;
  correspondenceId: string | null;
  hasDirectAttachment: boolean;
  assumptionOfDutySignedAt: string | null;
};

export function resolveEmployeeFileChecklist(input: {
  overrides: ChecklistOverrideRow[];
  qualifications: ChecklistQualificationCandidate[];
  credentials: ChecklistCredentialCandidate[];
  correspondences: ChecklistCorrespondenceCandidate[];
  selfServiceOnly?: boolean;
}): ResolvedChecklistItem[] {
  const overrideByType = new Map(
    input.overrides.map((row) => [row.itemType, row] as const),
  );

  return EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES.flatMap((itemType): ResolvedChecklistItem[] => {
    const override = overrideByType.get(itemType);
    const employeeVisible = override?.employeeVisible ?? true;

    if (input.selfServiceOnly && !employeeVisible) {
      return [];
    }

    const base = {
      itemType,
      label: checklistItemLabel(itemType),
      allowsNotApplicable: allowsNotApplicable(itemType),
      notApplicable: override?.notApplicable ?? false,
      notes: input.selfServiceOnly ? null : (override?.notes ?? null),
      employeeVisible,
      qualificationDocumentId: null as string | null,
      credentialId: null as string | null,
      correspondenceId: null as string | null,
      hasDirectAttachment: Boolean(override?.storageKey && override?.fileName),
      assumptionOfDutySignedAt: override?.assumptionOfDutySignedAt
        ? new Date(override.assumptionOfDutySignedAt).toISOString()
        : null,
    };

    if (override?.notApplicable) {
      return [
        {
          ...base,
          status: "NOT_APPLICABLE" as const,
          sourceKind: null,
          linkedLabel: null,
        },
      ];
    }

    if (itemType === "ACADEMIC_CERTIFICATES") {
      const visibleQualifications = input.selfServiceOnly
        ? input.qualifications.filter((item) => item.employeeVisible)
        : input.qualifications;
      const picked = pickQualification(override, visibleQualifications);

      if (picked?.hasAttachment || (picked && !input.selfServiceOnly)) {
        const uploaded =
          picked.hasAttachment || Boolean(override?.storageKey);
        return [
          {
            ...base,
            status: uploaded ? "UPLOADED" : "MISSING",
            sourceKind: "qualification",
            linkedLabel: picked.title,
            qualificationDocumentId: picked.id,
            hasDirectAttachment:
              base.hasDirectAttachment || picked.hasAttachment,
          },
        ];
      }

      if (base.hasDirectAttachment) {
        return [
          {
            ...base,
            status: "UPLOADED",
            sourceKind: "attachment",
            linkedLabel: override?.fileName ?? "Attachment",
          },
        ];
      }

      return [
        {
          ...base,
          status: "MISSING",
          sourceKind: null,
          linkedLabel: null,
        },
      ];
    }

    if (
      itemType === "COPY_OF_ID" ||
      itemType === "BIRTH_CERTIFICATE" ||
      itemType === "MARRIAGE_CERTIFICATE"
    ) {
      const visibleCredentials = input.selfServiceOnly
        ? input.credentials.filter((item) => item.employeeVisible)
        : input.credentials;
      const picked = pickCredential(itemType, override, visibleCredentials);

      if (picked?.hasAttachment) {
        return [
          {
            ...base,
            status: "UPLOADED",
            sourceKind: "credential",
            linkedLabel: picked.name,
            credentialId: picked.id,
            hasDirectAttachment: true,
          },
        ];
      }

      if (base.hasDirectAttachment) {
        return [
          {
            ...base,
            status: "UPLOADED",
            sourceKind: "attachment",
            linkedLabel: override?.fileName ?? "Attachment",
          },
        ];
      }

      if (picked) {
        return [
          {
            ...base,
            status: "MISSING",
            sourceKind: "credential",
            linkedLabel: picked.name,
            credentialId: picked.id,
          },
        ];
      }

      return [
        {
          ...base,
          status: "MISSING",
          sourceKind: null,
          linkedLabel: null,
        },
      ];
    }

    // ASSUMPTION_OF_DUTY
    if (override?.assumptionOfDutySignedAt) {
      return [
        {
          ...base,
          status: "SIGNED",
          sourceKind: "manual",
          linkedLabel: "Marked signed by HR",
        },
      ];
    }

    const visibleLetters = input.selfServiceOnly
      ? input.correspondences.filter((item) => item.employeeVisible)
      : input.correspondences;
    const letter = pickCorrespondence(override, visibleLetters);

    if (letter) {
      const signed =
        letter.status === "ACKNOWLEDGED" || Boolean(letter.acknowledgedAt);

      if (signed) {
        return [
          {
            ...base,
            status: "SIGNED",
            sourceKind: "correspondence",
            linkedLabel: letter.title,
            correspondenceId: letter.id,
          },
        ];
      }

      if (letter.status === "ISSUED") {
        return [
          {
            ...base,
            status: "PENDING",
            sourceKind: "correspondence",
            linkedLabel: letter.title,
            correspondenceId: letter.id,
          },
        ];
      }

      return [
        {
          ...base,
          status: "MISSING",
          sourceKind: "correspondence",
          linkedLabel: letter.title,
          correspondenceId: letter.id,
        },
      ];
    }

    if (base.hasDirectAttachment) {
      return [
        {
          ...base,
          status: "UPLOADED",
          sourceKind: "attachment",
          linkedLabel: override?.fileName ?? "Signed form",
        },
      ];
    }

    return [
      {
        ...base,
        status: "MISSING",
        sourceKind: null,
        linkedLabel: null,
      },
    ];
  });
}

export function checklistStatusLabel(
  status: EmployeeFileChecklistStatus,
): string {
  switch (status) {
    case "MISSING":
      return "Missing";
    case "UPLOADED":
      return "Uploaded";
    case "NOT_APPLICABLE":
      return "Not applicable";
    case "SIGNED":
      return "Signed";
    case "PENDING":
      return "Pending";
  }
}

/** Satisfied for onboarding/completeness: uploaded, signed, or marked N/A. */
export function isChecklistItemSatisfied(
  status: EmployeeFileChecklistStatus,
): boolean {
  return (
    status === "UPLOADED" ||
    status === "SIGNED" ||
    status === "NOT_APPLICABLE"
  );
}

export type ChecklistCompletenessSummary = {
  /** Items that count as done (incl. N/A). */
  completeCount: number;
  /** All checklist slots (typically 5). */
  totalCount: number;
  /** 0–100 integer percent. */
  percentComplete: number;
  isComplete: boolean;
  missingItemTypes: EmployeeFileChecklistItemType[];
  missingLabels: string[];
};

/**
 * Completeness treats N/A as satisfied so optional items do not block
 * onboarding progress. PENDING and MISSING remain incomplete.
 */
export function summarizeChecklistCompleteness(
  items: Array<{
    itemType: EmployeeFileChecklistItemType;
    label: string;
    status: EmployeeFileChecklistStatus;
  }>,
): ChecklistCompletenessSummary {
  const totalCount = items.length;
  const completeCount = items.filter((item) =>
    isChecklistItemSatisfied(item.status),
  ).length;
  const missing = items.filter(
    (item) => !isChecklistItemSatisfied(item.status),
  );

  return {
    completeCount,
    totalCount,
    percentComplete:
      totalCount === 0 ? 100 : Math.round((completeCount / totalCount) * 100),
    isComplete: totalCount > 0 && completeCount === totalCount,
    missingItemTypes: missing.map((item) => item.itemType),
    missingLabels: missing.map((item) => item.label),
  };
}
