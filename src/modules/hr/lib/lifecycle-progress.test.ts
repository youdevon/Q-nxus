import { describe, expect, it } from "vitest";

import {
  defaultLifecycleTaskDueAt,
  isLifecycleCaseAtRisk,
  isLifecycleTaskInReminderWindow,
  isLifecycleTaskOverdue,
  LIFECYCLE_MANDATORY_TASK_DUE_DAYS,
  LIFECYCLE_TASK_REMINDER_WINDOW_DAYS,
  lifecycleTaskProgress,
} from "@/src/modules/hr/lib/lifecycle-progress";

describe("lifecycleTaskProgress", () => {
  it("returns 0 for empty task lists", () => {
    expect(lifecycleTaskProgress([])).toBe(0);
  });

  it("counts completed and skipped tasks", () => {
    expect(
      lifecycleTaskProgress([
        { status: "COMPLETED" },
        { status: "SKIPPED" },
        { status: "PENDING" },
        { status: "IN_PROGRESS" },
      ]),
    ).toBe(50);
  });
});

describe("defaultLifecycleTaskDueAt", () => {
  it("adds the configured mandatory due days in UTC", () => {
    const openedAt = new Date("2026-07-19T12:00:00.000Z");
    const due = defaultLifecycleTaskDueAt(openedAt);
    expect(due.toISOString()).toBe("2026-07-26T12:00:00.000Z");
    expect(LIFECYCLE_MANDATORY_TASK_DUE_DAYS).toBe(7);
  });
});

describe("isLifecycleTaskOverdue / isLifecycleCaseAtRisk", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");

  it("treats open tasks past dueAt as overdue", () => {
    expect(
      isLifecycleTaskOverdue(
        { status: "PENDING", dueAt: new Date("2026-07-18T23:59:59.000Z") },
        now,
      ),
    ).toBe(true);
    expect(
      isLifecycleTaskOverdue(
        { status: "BLOCKED", dueAt: new Date("2026-07-18T00:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("ignores completed/skipped and missing due dates", () => {
    expect(
      isLifecycleTaskOverdue(
        { status: "COMPLETED", dueAt: new Date("2026-07-01T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(isLifecycleTaskOverdue({ status: "PENDING", dueAt: null }, now)).toBe(
      false,
    );
  });

  it("flags a case at risk when any open task is overdue", () => {
    expect(
      isLifecycleCaseAtRisk(
        [
          { status: "COMPLETED", dueAt: new Date("2026-07-01T00:00:00.000Z") },
          { status: "PENDING", dueAt: new Date("2026-07-20T00:00:00.000Z") },
        ],
        now,
      ),
    ).toBe(false);
    expect(
      isLifecycleCaseAtRisk(
        [
          { status: "PENDING", dueAt: new Date("2026-07-10T00:00:00.000Z") },
          { status: "IN_PROGRESS", dueAt: new Date("2026-07-25T00:00:00.000Z") },
        ],
        now,
      ),
    ).toBe(true);
  });
});

describe("isLifecycleTaskInReminderWindow", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");

  it("includes overdue and due-within-window tasks", () => {
    expect(LIFECYCLE_TASK_REMINDER_WINDOW_DAYS).toBe(2);
    expect(
      isLifecycleTaskInReminderWindow(
        { status: "PENDING", dueAt: new Date("2026-07-18T00:00:00.000Z") },
        now,
      ),
    ).toBe(true);
    expect(
      isLifecycleTaskInReminderWindow(
        { status: "IN_PROGRESS", dueAt: new Date("2026-07-21T11:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("excludes tasks beyond the window and done tasks", () => {
    expect(
      isLifecycleTaskInReminderWindow(
        { status: "PENDING", dueAt: new Date("2026-07-22T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isLifecycleTaskInReminderWindow(
        { status: "SKIPPED", dueAt: new Date("2026-07-19T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });
});
