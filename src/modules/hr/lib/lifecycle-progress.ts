/** Default due date offset for mandatory lifecycle tasks when a case opens. */
export const LIFECYCLE_MANDATORY_TASK_DUE_DAYS = 7;

/** Reminder window: notify when due within this many days (or already overdue). */
export const LIFECYCLE_TASK_REMINDER_WINDOW_DAYS = 2;

const DONE_STATUSES = new Set(["COMPLETED", "SKIPPED"]);

/** Progress for hire/exit lifecycle task lists. */
export function lifecycleTaskProgress(tasks: { status: string }[]): number {
  if (tasks.length === 0) {
    return 0;
  }
  const done = tasks.filter((task) => DONE_STATUSES.has(task.status)).length;
  return Math.round((done / tasks.length) * 100);
}

export function defaultLifecycleTaskDueAt(
  openedAt: Date,
  dueDays = LIFECYCLE_MANDATORY_TASK_DUE_DAYS,
): Date {
  const due = new Date(openedAt);
  due.setUTCDate(due.getUTCDate() + dueDays);
  return due;
}

export function isLifecycleTaskOpen(status: string): boolean {
  return (
    status === "PENDING" ||
    status === "IN_PROGRESS" ||
    status === "BLOCKED"
  );
}

export function isLifecycleTaskOverdue(
  task: { status: string; dueAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (!task.dueAt || !isLifecycleTaskOpen(task.status)) {
    return false;
  }
  return task.dueAt.getTime() < now.getTime();
}

/** Case is at risk when any open task is past its due date. */
export function isLifecycleCaseAtRisk(
  tasks: { status: string; dueAt?: Date | null }[],
  now: Date = new Date(),
): boolean {
  return tasks.some((task) => isLifecycleTaskOverdue(task, now));
}

/**
 * Open tasks whose due date is overdue or falls within the reminder window
 * (dueAt <= now + windowDays).
 */
export function isLifecycleTaskInReminderWindow(
  task: { status: string; dueAt?: Date | null },
  now: Date = new Date(),
  windowDays = LIFECYCLE_TASK_REMINDER_WINDOW_DAYS,
): boolean {
  if (!task.dueAt || !isLifecycleTaskOpen(task.status)) {
    return false;
  }
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays);
  return task.dueAt.getTime() <= windowEnd.getTime();
}
