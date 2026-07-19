import type { LifecycleTaskCode, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

const ONBOARDING_TASKS: Array<{
  code: LifecycleTaskCode;
  label: string;
  sortOrder: number;
}> = [
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

const OFFBOARDING_TASKS: Array<{
  code: LifecycleTaskCode;
  label: string;
  sortOrder: number;
}> = [
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

export async function openEmployeeOnboardingCase(input: {
  organizationId: string;
  employeeId: string;
  openedByUserId: string | null;
  notes?: string | null;
  client?: Tx;
}) {
  const client = input.client ?? prisma;

  const existing = await client.employeeOnboardingCase.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["OPEN", "READY"] },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const [employee, priorContractCount] = await Promise.all([
    client.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        workforceCategory: true,
        nisNumber: true,
        birNumber: true,
      },
    }),
    client.employmentContract.count({
      where: { employeeId: input.employeeId },
    }),
  ]);

  const continuingEmployee = priorContractCount > 0;
  const caseNotes = [
    input.notes?.trim() || null,
    continuingEmployee
      ? "Continuing employee: standing file documents may already be on file from a prior contract."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const created = await client.employeeOnboardingCase.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      openedByUserId: input.openedByUserId,
      notes: caseNotes || null,
      tasks: {
        create: ONBOARDING_TASKS.map((task) => ({
          code: task.code,
          label: task.label,
          sortOrder: task.sortOrder,
        })),
      },
    },
    select: {
      id: true,
      tasks: { select: { id: true, code: true } },
    },
  });

  await applyExistingFileStateToOnboardingCase({
    caseId: created.id,
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    workforceCategory: employee?.workforceCategory ?? null,
    openedByUserId: input.openedByUserId,
    continuingEmployee,
    hasNis: Boolean(employee?.nisNumber?.trim()),
    hasBir: Boolean(employee?.birNumber?.trim()),
    client,
  });

  return { id: created.id };
}

/**
 * Seed checklist slots and auto-complete file tasks that are already satisfied
 * for continuing employees (ID, birth cert, etc. carry across contracts).
 * Assumption of duty stays pending — often needed for a new engagement.
 */
async function applyExistingFileStateToOnboardingCase(input: {
  caseId: string;
  organizationId: string;
  employeeId: string;
  workforceCategory: import("@/generated/prisma/client").WorkforceCategory | null;
  openedByUserId: string | null;
  continuingEmployee: boolean;
  hasNis: boolean;
  hasBir: boolean;
  client: Tx;
}) {
  const { seedChecklistFromPack } = await import(
    "@/src/modules/hr/services/employee-file-packs"
  );
  const { getEmployeeFileChecklist } = await import(
    "@/src/modules/hr/data/get-employee-file-checklist"
  );
  const { assessStandingEmployeeFileDocs } = await import(
    "@/src/modules/hr/lib/employee-file-checklist"
  );

  await seedChecklistFromPack({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    workforceCategory: input.workforceCategory,
  });

  const checklist = await getEmployeeFileChecklist(input.employeeId);
  const standing = assessStandingEmployeeFileDocs(checklist?.items ?? []);
  const completedAt = new Date();
  const actorId = input.openedByUserId;

  const seedTask = await input.client.employeeOnboardingTask.findFirst({
    where: { caseId: input.caseId, code: "SEED_FILE_CHECKLIST" },
    select: { id: true },
  });

  if (seedTask) {
    await input.client.employeeOnboardingTask.update({
      where: { id: seedTask.id },
      data: {
        status: "COMPLETED",
        completedAt,
        completedByUserId: actorId,
        notes: input.continuingEmployee
          ? "Checklist seeded; existing employee-file slots preserved."
          : "Checklist seeded from the default document pack.",
      },
    });
  }

  if (standing.standingDocsComplete) {
    const docsTask = await input.client.employeeOnboardingTask.findFirst({
      where: { caseId: input.caseId, code: "COMPLETE_REQUIRED_DOCS" },
      select: { id: true },
    });

    if (docsTask) {
      const statutoryNote =
        input.hasNis && input.hasBir
          ? " NIS and BIR are already on the employee record."
          : input.hasNis || input.hasBir
            ? ` ${input.hasNis ? "NIS" : "BIR"} is on file; confirm the other statutory number if required for payroll.`
            : " Confirm NIS/BIR on the employee record before payroll readiness.";

      await input.client.employeeOnboardingTask.update({
        where: { id: docsTask.id },
        data: {
          status: "COMPLETED",
          completedAt,
          completedByUserId: actorId,
          notes: `Standing file documents already on file from prior employment.${statutoryNote} Assumption of duty remains a separate task if a new letter is required.`,
        },
      });
    }
  } else if (standing.missingLabels.length > 0) {
    const docsTask = await input.client.employeeOnboardingTask.findFirst({
      where: { caseId: input.caseId, code: "COMPLETE_REQUIRED_DOCS" },
      select: { id: true },
    });

    if (docsTask) {
      await input.client.employeeOnboardingTask.update({
        where: { id: docsTask.id },
        data: {
          notes: `Still missing: ${standing.missingLabels.join(", ")}.`,
        },
      });
    }
  }
}

export async function openEmployeeOffboardingCase(input: {
  organizationId: string;
  employeeId: string;
  openedByUserId: string | null;
  reason?: string | null;
  notes?: string | null;
  client?: Tx;
}) {
  const client = input.client ?? prisma;

  const existing = await client.employeeOffboardingCase.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["OPEN", "CLEARED"] },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return client.employeeOffboardingCase.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      openedByUserId: input.openedByUserId,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      tasks: {
        create: OFFBOARDING_TASKS.map((task) => ({
          code: task.code,
          label: task.label,
          sortOrder: task.sortOrder,
        })),
      },
    },
    select: { id: true },
  });
}

export async function completeOnboardingTask(input: {
  taskId: string;
  completedByUserId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notes?: string | null;
}) {
  const task = await prisma.employeeOnboardingTask.update({
    where: { id: input.taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: input.completedByUserId,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      code: true,
      caseId: true,
      case: {
        select: {
          employeeId: true,
          organizationId: true,
          tasks: { select: { status: true, code: true } },
          employee: {
            select: {
              workforceCategory: true,
            },
          },
        },
      },
    },
  });

  if (task.code === "SEED_FILE_CHECKLIST") {
    const { seedChecklistFromPack } = await import(
      "@/src/modules/hr/services/employee-file-packs"
    );
    await seedChecklistFromPack({
      organizationId: task.case.organizationId,
      employeeId: task.case.employeeId,
      workforceCategory: task.case.employee.workforceCategory,
    });
  }

  const taskStatuses = task.case.tasks.map((row) =>
    row.code === task.code ? { ...row, status: "COMPLETED" as const } : row,
  );

  const allDone = taskStatuses.every(
    (row) => row.status === "COMPLETED" || row.status === "SKIPPED",
  );
  const contractActive = taskStatuses.some(
    (row) => row.code === "ACTIVATE_CONTRACT" && row.status === "COMPLETED",
  );
  const docsDone = taskStatuses.some(
    (row) =>
      row.code === "COMPLETE_REQUIRED_DOCS" && row.status === "COMPLETED",
  );

  if (contractActive && docsDone) {
    await prisma.employeeOnboardingCase.update({
      where: { id: task.caseId },
      data: {
        status: allDone ? "COMPLETED" : "READY",
        readyAt: new Date(),
        completedAt: allDone ? new Date() : null,
      },
    });
  }

  return task;
}

export async function completeOffboardingTask(input: {
  taskId: string;
  completedByUserId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notes?: string | null;
}) {
  const task = await prisma.employeeOffboardingTask.update({
    where: { id: input.taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: input.completedByUserId,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      code: true,
      caseId: true,
      case: {
        select: {
          employeeId: true,
          tasks: { select: { status: true, code: true } },
        },
      },
    },
  });

  if (task.code === "FREEZE_EMPLOYEE_FILE") {
    await prisma.employee.update({
      where: { id: task.case.employeeId },
      data: { fileFrozenAt: new Date() },
    });
  }

  if (task.code === "REVOKE_ACCESS") {
    await prisma.user.updateMany({
      where: { employeeId: task.case.employeeId },
      data: { isActive: false, status: "DISABLED" },
    });
  }

  const allDone = task.case.tasks.every(
    (row) => row.status === "COMPLETED" || row.status === "SKIPPED",
  );

  if (allDone) {
    await prisma.employeeOffboardingCase.update({
      where: { id: task.caseId },
      data: {
        status: "COMPLETED",
        clearedAt: new Date(),
        completedAt: new Date(),
      },
    });
  } else {
    const criticalDone = task.case.tasks
      .filter((row) =>
        ["CLOSE_CONTRACT", "FREEZE_EMPLOYEE_FILE", "REVOKE_ACCESS"].includes(
          row.code,
        ),
      )
      .every((row) => row.status === "COMPLETED" || row.status === "SKIPPED");

    if (criticalDone) {
      await prisma.employeeOffboardingCase.update({
        where: { id: task.caseId },
        data: { status: "CLEARED", clearedAt: new Date() },
      });
    }
  }

  return task;
}

export async function getEmployeeLifecycleCases(employeeId: string) {
  const [onboarding, offboarding] = await Promise.all([
    prisma.employeeOnboardingCase.findMany({
      where: { employeeId },
      orderBy: { openedAt: "desc" },
      include: {
        tasks: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.employeeOffboardingCase.findMany({
      where: { employeeId },
      orderBy: { openedAt: "desc" },
      include: {
        tasks: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  return { onboarding, offboarding };
}

/**
 * Cancel an open/ready onboarding case started in error.
 * Does not delete historical completed tasks; marks remaining pending work skipped.
 */
export async function cancelEmployeeOnboardingCase(input: {
  caseId: string;
  cancelledByUserId: string;
  notes?: string | null;
}) {
  const existing = await prisma.employeeOnboardingCase.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      status: true,
      employeeId: true,
    },
  });

  if (!existing) {
    throw new Error("ONBOARDING_CASE_NOT_FOUND");
  }

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new Error("ONBOARDING_CASE_NOT_CANCELLABLE");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeOnboardingTask.updateMany({
      where: {
        caseId: input.caseId,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
      },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        completedByUserId: input.cancelledByUserId,
        notes: input.notes ?? "Skipped because onboarding was cancelled.",
      },
    });

    await transaction.employeeOnboardingCase.update({
      where: { id: input.caseId },
      data: {
        status: "CANCELLED",
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });
  });

  return { employeeId: existing.employeeId };
}

/**
 * Cancel an open/cleared offboarding case started in error.
 * Clears file freeze if the freeze task had already been completed.
 * Does not automatically re-enable a revoked user account.
 */
export async function cancelEmployeeOffboardingCase(input: {
  caseId: string;
  cancelledByUserId: string;
  notes?: string | null;
}) {
  const existing = await prisma.employeeOffboardingCase.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      tasks: {
        select: {
          code: true,
          status: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("OFFBOARDING_CASE_NOT_FOUND");
  }

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new Error("OFFBOARDING_CASE_NOT_CANCELLABLE");
  }

  const freezeDone = existing.tasks.some(
    (task) =>
      task.code === "FREEZE_EMPLOYEE_FILE" && task.status === "COMPLETED",
  );
  const accessRevoked = existing.tasks.some(
    (task) => task.code === "REVOKE_ACCESS" && task.status === "COMPLETED",
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeOffboardingTask.updateMany({
      where: {
        caseId: input.caseId,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
      },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        completedByUserId: input.cancelledByUserId,
        notes: input.notes ?? "Skipped because offboarding was cancelled.",
      },
    });

    await transaction.employeeOffboardingCase.update({
      where: { id: input.caseId },
      data: {
        status: "CANCELLED",
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    if (freezeDone) {
      await transaction.employee.update({
        where: { id: existing.employeeId },
        data: { fileFrozenAt: null },
      });
    }
  });

  return {
    employeeId: existing.employeeId,
    accessRevoked,
    fileUnfrozen: freezeDone,
  };
}

