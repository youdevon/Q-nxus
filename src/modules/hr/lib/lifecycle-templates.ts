import type {
  LifecycleTaskCode,
  OffboardingCaseReason,
  OnboardingCaseType,
} from "@/generated/prisma/client";

export type LifecycleTemplateTaskSpec = {
  code: LifecycleTaskCode;
  label: string;
  sortOrder: number;
  mandatory?: boolean;
};

export type LifecycleTemplateCandidate = {
  id: string;
  code: string;
  isDefault: boolean;
  matchCaseType: OnboardingCaseType | null;
  matchReasonCode: OffboardingCaseReason | null;
  tasks: LifecycleTemplateTaskSpec[];
};

/** Hardcoded fallback when no org templates exist (pre-seed / empty pack). */
export const FALLBACK_ONBOARDING_TASKS: LifecycleTemplateTaskSpec[] = [
  {
    code: "CREATE_DRAFT_CONTRACT",
    label: "Create draft employment contract",
    sortOrder: 10,
  },
  {
    code: "SEED_FILE_CHECKLIST",
    label: "Seed employee file checklist",
    sortOrder: 20,
  },
  {
    code: "ISSUE_ASSUMPTION_OF_DUTY",
    label: "Issue assumption of duty letter",
    sortOrder: 30,
  },
  {
    code: "COMPLETE_REQUIRED_DOCS",
    label: "Complete required employee-file documents",
    sortOrder: 40,
  },
  {
    code: "ACTIVATE_CONTRACT",
    label: "Activate employment contract",
    sortOrder: 50,
  },
  {
    code: "PAYROLL_READINESS",
    label: "Confirm payroll readiness",
    sortOrder: 60,
  },
];

/** Hardcoded fallback when no org templates exist (pre-seed / empty pack). */
export const FALLBACK_OFFBOARDING_TASKS: LifecycleTemplateTaskSpec[] = [
  {
    code: "CLOSE_CONTRACT",
    label: "Close current employment contract",
    sortOrder: 10,
  },
  {
    code: "FREEZE_EMPLOYEE_FILE",
    label: "Freeze employee file",
    sortOrder: 20,
  },
  {
    code: "FINAL_PAY_CHECK",
    label: "Confirm final pay / gratuity check",
    sortOrder: 30,
  },
  {
    code: "REVOKE_ACCESS",
    label: "Revoke system access",
    sortOrder: 40,
  },
];

function normalizeTasks(
  tasks: LifecycleTemplateTaskSpec[],
): LifecycleTemplateTaskSpec[] {
  return [...tasks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((task) => ({
      code: task.code,
      label: task.label,
      sortOrder: task.sortOrder,
      mandatory: task.mandatory ?? true,
    }));
}

/**
 * Pick onboarding tasks: matchCaseType → isDefault → hardcoded fallback.
 */
export function resolveOnboardingTemplateTasks(
  templates: LifecycleTemplateCandidate[],
  caseType: OnboardingCaseType,
): LifecycleTemplateTaskSpec[] {
  const matched =
    templates.find((row) => row.matchCaseType === caseType) ??
    templates.find((row) => row.isDefault) ??
    null;

  if (!matched || matched.tasks.length === 0) {
    return normalizeTasks(FALLBACK_ONBOARDING_TASKS);
  }

  return normalizeTasks(matched.tasks);
}

/**
 * Pick offboarding tasks: matchReasonCode → isDefault → hardcoded fallback.
 */
export function resolveOffboardingTemplateTasks(
  templates: LifecycleTemplateCandidate[],
  reasonCode: OffboardingCaseReason | null | undefined,
): LifecycleTemplateTaskSpec[] {
  const matched =
    (reasonCode
      ? templates.find((row) => row.matchReasonCode === reasonCode)
      : null) ??
    templates.find((row) => row.isDefault) ??
    null;

  if (!matched || matched.tasks.length === 0) {
    return normalizeTasks(FALLBACK_OFFBOARDING_TASKS);
  }

  return normalizeTasks(matched.tasks);
}
