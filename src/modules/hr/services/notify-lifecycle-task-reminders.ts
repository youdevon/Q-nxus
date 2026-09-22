import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isLifecycleTaskInReminderWindow,
  LIFECYCLE_TASK_REMINDER_WINDOW_DAYS,
} from "@/src/modules/hr/lib/lifecycle-progress";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type LifecycleTaskReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

type ReminderCandidate = {
  relatedType: "EmployeeOnboardingTask" | "EmployeeOffboardingTask";
  taskId: string;
  label: string;
  dueAt: Date;
  assigneeUserId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  assignee: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
};

/**
 * Notifies task assignees when open lifecycle tasks are overdue or due within
 * {@link LIFECYCLE_TASK_REMINDER_WINDOW_DAYS} days. Deduplicates per task +
 * title within the last 3 days.
 */
export async function notifyLifecycleTaskReminders(): Promise<LifecycleTaskReminderResult> {
  const now = new Date();
  const windowEnd = addUtcDays(now, LIFECYCLE_TASK_REMINDER_WINDOW_DAYS);
  const openStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED"] as const;

  const [onboardingTasks, offboardingTasks] = await Promise.all([
    prisma.employeeOnboardingTask.findMany({
      where: {
        status: { in: [...openStatuses] },
        dueAt: { not: null, lte: windowEnd },
        assigneeUserId: { not: null },
        case: {
          status: { in: ["OPEN", "READY"] },
        },
      },
      select: {
        id: true,
        label: true,
        status: true,
        dueAt: true,
        assigneeUserId: true,
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
        case: {
          select: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                preferredName: true,
              },
            },
          },
        },
      },
    }),
    prisma.employeeOffboardingTask.findMany({
      where: {
        status: { in: [...openStatuses] },
        dueAt: { not: null, lte: windowEnd },
        assigneeUserId: { not: null },
        case: {
          status: { in: ["OPEN", "CLEARED"] },
        },
      },
      select: {
        id: true,
        label: true,
        status: true,
        dueAt: true,
        assigneeUserId: true,
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
        case: {
          select: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                preferredName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const candidates: ReminderCandidate[] = [];

  for (const task of onboardingTasks) {
    if (
      !task.dueAt ||
      !task.assigneeUserId ||
      !task.assignee?.isActive ||
      !isLifecycleTaskInReminderWindow(task, now)
    ) {
      continue;
    }
    const employee = task.case.employee;
    candidates.push({
      relatedType: "EmployeeOnboardingTask",
      taskId: task.id,
      label: task.label,
      dueAt: task.dueAt,
      assigneeUserId: task.assigneeUserId,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName:
        `${employee.preferredName ?? employee.firstName} ${employee.lastName}`.trim(),
      assignee: {
        id: task.assignee.id,
        email: task.assignee.email,
        firstName: task.assignee.firstName,
        lastName: task.assignee.lastName,
      },
    });
  }

  for (const task of offboardingTasks) {
    if (
      !task.dueAt ||
      !task.assigneeUserId ||
      !task.assignee?.isActive ||
      !isLifecycleTaskInReminderWindow(task, now)
    ) {
      continue;
    }
    const employee = task.case.employee;
    candidates.push({
      relatedType: "EmployeeOffboardingTask",
      taskId: task.id,
      label: task.label,
      dueAt: task.dueAt,
      assigneeUserId: task.assigneeUserId,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName:
        `${employee.preferredName ?? employee.firstName} ${employee.lastName}`.trim(),
      assignee: {
        id: task.assignee.id,
        email: task.assignee.email,
        firstName: task.assignee.firstName,
        lastName: task.assignee.lastName,
      },
    });
  }

  let notified = 0;
  let skipped = 0;
  const dedupeSince = addUtcDays(now, -3);

  for (const candidate of candidates) {
    const overdue = candidate.dueAt.getTime() < now.getTime();
    const dueIso = candidate.dueAt.toISOString().slice(0, 10);
    const title = overdue
      ? `Lifecycle task overdue: ${candidate.label}`
      : `Lifecycle task due soon: ${candidate.label}`;

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType: candidate.relatedType,
        relatedId: candidate.taskId,
        title,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await createSystemNotification({
      title,
      message: `${candidate.employeeNumber} · ${candidate.employeeName} — due ${dueIso}.`,
      severity: overdue
        ? NotificationSeverity.WARNING
        : NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${candidate.employeeId}`,
      relatedType: candidate.relatedType,
      relatedId: candidate.taskId,
      recipients: [
        {
          userId: candidate.assignee.id,
          email: candidate.assignee.email,
          name: `${candidate.assignee.firstName} ${candidate.assignee.lastName}`,
          sendEmail: false,
        },
      ],
    });

    notified += 1;
  }

  return {
    considered: candidates.length,
    notified,
    skipped,
  };
}
