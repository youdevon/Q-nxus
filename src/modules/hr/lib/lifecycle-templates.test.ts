import { describe, expect, it } from "vitest";

import {
  FALLBACK_OFFBOARDING_TASKS,
  FALLBACK_ONBOARDING_TASKS,
  resolveOffboardingTemplateTasks,
  resolveOnboardingTemplateTasks,
  type LifecycleTemplateCandidate,
} from "@/src/modules/hr/lib/lifecycle-templates";

const onboardingPacks: LifecycleTemplateCandidate[] = [
  {
    id: "t-new",
    code: "NEW_HIRE",
    isDefault: true,
    matchCaseType: "NEW_HIRE",
    matchReasonCode: null,
    tasks: [
      {
        code: "CREATE_DRAFT_CONTRACT",
        label: "Create draft",
        sortOrder: 10,
      },
      {
        code: "ACTIVATE_CONTRACT",
        label: "Activate",
        sortOrder: 20,
      },
    ],
  },
  {
    id: "t-cont",
    code: "CONTINUING",
    isDefault: false,
    matchCaseType: "CONTINUING",
    matchReasonCode: null,
    tasks: [
      {
        code: "ACTIVATE_CONTRACT",
        label: "Activate continuing",
        sortOrder: 10,
      },
      {
        code: "PAYROLL_READINESS",
        label: "Payroll",
        sortOrder: 20,
      },
    ],
  },
];

const offboardingPacks: LifecycleTemplateCandidate[] = [
  {
    id: "t-res",
    code: "RESIGNATION",
    isDefault: false,
    matchCaseType: null,
    matchReasonCode: "RESIGNATION",
    tasks: [
      {
        code: "CLOSE_CONTRACT",
        label: "Close (resignation)",
        sortOrder: 10,
      },
      {
        code: "REVOKE_ACCESS",
        label: "Revoke",
        sortOrder: 20,
      },
    ],
  },
  {
    id: "t-def",
    code: "DEFAULT_EXIT",
    isDefault: true,
    matchCaseType: null,
    matchReasonCode: null,
    tasks: [
      {
        code: "CLOSE_CONTRACT",
        label: "Close (default)",
        sortOrder: 10,
      },
      {
        code: "FINAL_PAY_CHECK",
        label: "Final pay",
        sortOrder: 20,
      },
      {
        code: "REVOKE_ACCESS",
        label: "Revoke",
        sortOrder: 30,
      },
    ],
  },
];

describe("resolveOnboardingTemplateTasks", () => {
  it("matches by caseType when a pack is configured", () => {
    const tasks = resolveOnboardingTemplateTasks(onboardingPacks, "CONTINUING");
    expect(tasks.map((row) => row.code)).toEqual([
      "ACTIVATE_CONTRACT",
      "PAYROLL_READINESS",
    ]);
    expect(tasks[0]?.label).toBe("Activate continuing");
  });

  it("falls back to the default onboarding pack", () => {
    const tasks = resolveOnboardingTemplateTasks(onboardingPacks, "REHIRE");
    expect(tasks.map((row) => row.code)).toEqual([
      "CREATE_DRAFT_CONTRACT",
      "ACTIVATE_CONTRACT",
    ]);
  });

  it("falls back to hardcoded tasks when no templates exist", () => {
    expect(resolveOnboardingTemplateTasks([], "NEW_HIRE")).toEqual(
      FALLBACK_ONBOARDING_TASKS.map((task) => ({
        ...task,
        mandatory: true,
      })),
    );
  });

  it("falls back when the matched pack has no tasks", () => {
    const emptyDefault: LifecycleTemplateCandidate[] = [
      {
        id: "empty",
        code: "NEW_HIRE",
        isDefault: true,
        matchCaseType: "NEW_HIRE",
        matchReasonCode: null,
        tasks: [],
      },
    ];
    expect(resolveOnboardingTemplateTasks(emptyDefault, "NEW_HIRE")).toEqual(
      FALLBACK_ONBOARDING_TASKS.map((task) => ({
        ...task,
        mandatory: true,
      })),
    );
  });
});

describe("resolveOffboardingTemplateTasks", () => {
  it("matches by reasonCode when a pack is configured", () => {
    const tasks = resolveOffboardingTemplateTasks(
      offboardingPacks,
      "RESIGNATION",
    );
    expect(tasks.map((row) => row.label)).toEqual([
      "Close (resignation)",
      "Revoke",
    ]);
  });

  it("falls back to the default exit pack for other reasons", () => {
    const tasks = resolveOffboardingTemplateTasks(
      offboardingPacks,
      "TERMINATION",
    );
    expect(tasks.map((row) => row.code)).toEqual([
      "CLOSE_CONTRACT",
      "FINAL_PAY_CHECK",
      "REVOKE_ACCESS",
    ]);
  });

  it("uses the default exit pack when reasonCode is null", () => {
    const tasks = resolveOffboardingTemplateTasks(offboardingPacks, null);
    expect(tasks[0]?.label).toBe("Close (default)");
  });

  it("falls back to hardcoded tasks when no templates exist", () => {
    expect(resolveOffboardingTemplateTasks([], "RESIGNATION")).toEqual(
      FALLBACK_OFFBOARDING_TASKS.map((task) => ({
        ...task,
        mandatory: true,
      })),
    );
  });
});
