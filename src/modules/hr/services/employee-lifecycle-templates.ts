import type {
  LifecycleTemplateKind,
  OffboardingCaseReason,
  OnboardingCaseType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  FALLBACK_OFFBOARDING_TASKS,
  FALLBACK_ONBOARDING_TASKS,
  resolveOffboardingTemplateTasks,
  resolveOnboardingTemplateTasks,
  type LifecycleTemplateCandidate,
  type LifecycleTemplateTaskSpec,
} from "@/src/modules/hr/lib/lifecycle-templates";

type Tx = Prisma.TransactionClient | typeof prisma;

const DEFAULT_ONBOARDING_TASKS = FALLBACK_ONBOARDING_TASKS.map((task) => ({
  ...task,
  mandatory: true,
}));

const DEFAULT_OFFBOARDING_TASKS = FALLBACK_OFFBOARDING_TASKS.map((task) => ({
  ...task,
  mandatory: true,
}));

type DefaultTemplateSeed = {
  kind: LifecycleTemplateKind;
  code: string;
  name: string;
  isDefault: boolean;
  matchCaseType?: OnboardingCaseType | null;
  matchReasonCode?: OffboardingCaseReason | null;
  tasks: LifecycleTemplateTaskSpec[];
};

const DEFAULT_TEMPLATES: DefaultTemplateSeed[] = [
  {
    kind: "ONBOARDING",
    code: "NEW_HIRE",
    name: "New hire onboarding",
    isDefault: true,
    matchCaseType: "NEW_HIRE",
    tasks: DEFAULT_ONBOARDING_TASKS,
  },
  {
    kind: "ONBOARDING",
    code: "CONTINUING",
    name: "Continuing employee onboarding",
    isDefault: false,
    matchCaseType: "CONTINUING",
    tasks: DEFAULT_ONBOARDING_TASKS,
  },
  {
    kind: "OFFBOARDING",
    code: "RESIGNATION",
    name: "Resignation exit",
    isDefault: false,
    matchReasonCode: "RESIGNATION",
    tasks: DEFAULT_OFFBOARDING_TASKS,
  },
  {
    kind: "OFFBOARDING",
    code: "DEFAULT_EXIT",
    name: "Default exit pack",
    isDefault: true,
    tasks: DEFAULT_OFFBOARDING_TASKS,
  },
];

/**
 * Seed org default hire/exit packs when none exist yet (idempotent).
 */
export async function ensureDefaultLifecycleTemplates(
  organizationId: string,
  client: Tx = prisma,
) {
  const existingCount = await client.employeeLifecycleTemplate.count({
    where: { organizationId },
  });

  if (existingCount > 0) {
    return { created: false, count: existingCount };
  }

  for (const template of DEFAULT_TEMPLATES) {
    await client.employeeLifecycleTemplate.create({
      data: {
        organizationId,
        kind: template.kind,
        code: template.code,
        name: template.name,
        isDefault: template.isDefault,
        isActive: true,
        matchCaseType: template.matchCaseType ?? null,
        matchReasonCode: template.matchReasonCode ?? null,
        tasks: {
          create: template.tasks.map((task) => ({
            code: task.code,
            label: task.label,
            sortOrder: task.sortOrder,
            mandatory: task.mandatory ?? true,
          })),
        },
      },
    });
  }

  return { created: true, count: DEFAULT_TEMPLATES.length };
}

async function loadActiveTemplates(
  organizationId: string,
  kind: LifecycleTemplateKind,
  client: Tx,
): Promise<LifecycleTemplateCandidate[]> {
  const rows = await client.employeeLifecycleTemplate.findMany({
    where: {
      organizationId,
      kind,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      isDefault: true,
      matchCaseType: true,
      matchReasonCode: true,
      tasks: {
        orderBy: { sortOrder: "asc" },
        select: {
          code: true,
          label: true,
          sortOrder: true,
          mandatory: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });

  return rows;
}

export async function resolveTasksForOnboardingCase(input: {
  organizationId: string;
  caseType: OnboardingCaseType;
  client?: Tx;
}): Promise<LifecycleTemplateTaskSpec[]> {
  const client = input.client ?? prisma;
  await ensureDefaultLifecycleTemplates(input.organizationId, client);
  const templates = await loadActiveTemplates(
    input.organizationId,
    "ONBOARDING",
    client,
  );
  return resolveOnboardingTemplateTasks(templates, input.caseType);
}

export async function resolveTasksForOffboardingCase(input: {
  organizationId: string;
  reasonCode?: OffboardingCaseReason | null;
  client?: Tx;
}): Promise<LifecycleTemplateTaskSpec[]> {
  const client = input.client ?? prisma;
  await ensureDefaultLifecycleTemplates(input.organizationId, client);
  const templates = await loadActiveTemplates(
    input.organizationId,
    "OFFBOARDING",
    client,
  );
  return resolveOffboardingTemplateTasks(templates, input.reasonCode);
}
