/**
 * Jurisdiction / compliance packs (config-driven).
 * Phase 6 foundation — expand packs without hard-coding into schema enums.
 */

export type ComplianceJurisdiction = "TT" | "BB" | "JM" | "GENERIC";

export type CompliancePack = {
  jurisdiction: ComplianceJurisdiction;
  label: string;
  /** Suggested notice period days by employment type hint. */
  defaultNoticePeriodDays: number;
  /** Suggested probation length in days. */
  defaultProbationDays: number;
  /** Fixed-term contracts longer than this may need review. */
  maxFixedTermMonths: number | null;
  requiredChecklistHints: string[];
  policyAckHints: string[];
};

export const COMPLIANCE_PACKS: Record<ComplianceJurisdiction, CompliancePack> =
  {
    TT: {
      jurisdiction: "TT",
      label: "Trinidad and Tobago",
      defaultNoticePeriodDays: 30,
      defaultProbationDays: 90,
      maxFixedTermMonths: 36,
      requiredChecklistHints: [
        "National ID or passport copy",
        "NIS number on employee record",
        "BIR number on employee record",
        "Assumption of duty acknowledgement",
      ],
      policyAckHints: ["Code of conduct", "Data protection acknowledgement"],
    },
    BB: {
      jurisdiction: "BB",
      label: "Barbados",
      defaultNoticePeriodDays: 28,
      defaultProbationDays: 90,
      maxFixedTermMonths: 24,
      requiredChecklistHints: [
        "National ID copy",
        "NIS / social security reference",
        "Assumption of duty",
      ],
      policyAckHints: ["Workplace policy acknowledgement"],
    },
    JM: {
      jurisdiction: "JM",
      label: "Jamaica",
      defaultNoticePeriodDays: 30,
      defaultProbationDays: 90,
      maxFixedTermMonths: 36,
      requiredChecklistHints: [
        "National ID copy",
        "TRN on employee record where applicable",
        "Assumption of duty",
      ],
      policyAckHints: ["Workplace policy acknowledgement"],
    },
    GENERIC: {
      jurisdiction: "GENERIC",
      label: "Generic",
      defaultNoticePeriodDays: 30,
      defaultProbationDays: 90,
      maxFixedTermMonths: null,
      requiredChecklistHints: [
        "Government ID",
        "Signed employment contract",
        "Assumption of duty / start letter",
      ],
      policyAckHints: ["Core policy acknowledgements"],
    },
  };

export function resolveCompliancePack(
  jurisdiction: string | null | undefined,
): CompliancePack {
  const key = (jurisdiction ?? "TT").toUpperCase();
  if (key === "TT" || key === "BB" || key === "JM") {
    return COMPLIANCE_PACKS[key];
  }
  return COMPLIANCE_PACKS.GENERIC;
}

export type MissingDocSuggestion = {
  code: string;
  label: string;
  reason: string;
};

/**
 * Lightweight rule-based suggestions (AI-assist placeholder).
 * Replace with model calls behind an admin feature flag later.
 */
export function suggestMissingEmployeeFileItems(input: {
  jurisdiction?: string | null;
  hasActiveContract: boolean;
  checklistMissingLabels: string[];
  openUpdateRequestCount: number;
}): MissingDocSuggestion[] {
  const pack = resolveCompliancePack(input.jurisdiction);
  const suggestions: MissingDocSuggestion[] = [];

  if (!input.hasActiveContract) {
    suggestions.push({
      code: "ACTIVE_CONTRACT",
      label: "Activate employment contract",
      reason: "Payroll and leave require an active current contract.",
    });
  }

  for (const label of input.checklistMissingLabels) {
    suggestions.push({
      code: "CHECKLIST",
      label,
      reason: `Required by ${pack.label} employee-file guidance.`,
    });
  }

  if (input.openUpdateRequestCount > 0) {
    suggestions.push({
      code: "OPEN_REQUESTS",
      label: "Resolve open employee file requests",
      reason: `${input.openUpdateRequestCount} self-service request(s) awaiting HR.`,
    });
  }

  for (const hint of pack.requiredChecklistHints) {
    if (
      !suggestions.some((row) =>
        row.label.toLowerCase().includes(hint.toLowerCase().slice(0, 8)),
      )
    ) {
      suggestions.push({
        code: "JURISDICTION_HINT",
        label: hint,
        reason: `${pack.label} compliance pack reminder.`,
      });
    }
  }

  return suggestions.slice(0, 12);
}

export function summarizeContractAmendment(input: {
  changeType: string;
  previousJobTitle?: string | null;
  nextJobTitle?: string | null;
  previousSalary?: string | null;
  nextSalary?: string | null;
}): string {
  const parts: string[] = [`Change type: ${input.changeType.replaceAll("_", " ").toLowerCase()}.`];

  if (
    input.previousJobTitle &&
    input.nextJobTitle &&
    input.previousJobTitle !== input.nextJobTitle
  ) {
    parts.push(
      `Role changed from “${input.previousJobTitle}” to “${input.nextJobTitle}”.`,
    );
  }

  if (
    input.previousSalary &&
    input.nextSalary &&
    input.previousSalary !== input.nextSalary
  ) {
    parts.push(
      `Base salary moved from ${input.previousSalary} to ${input.nextSalary}.`,
    );
  }

  if (parts.length === 1) {
    parts.push("No material title or salary delta detected in the summary fields.");
  }

  return parts.join(" ");
}
