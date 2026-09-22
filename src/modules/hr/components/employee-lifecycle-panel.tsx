"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assignEmployeeLifecycleTask,
  blockEmployeeLifecycleTask,
  cancelEmployeeOffboarding,
  cancelEmployeeOnboarding,
  markOffboardingTaskComplete,
  markOnboardingTaskComplete,
  setEmployeeLifecycleTaskDueDate,
  startEmployeeOffboarding,
  startEmployeeOnboarding,
  type LifecycleActionState,
} from "@/src/modules/hr/actions/manage-employee-lifecycle";
import { isLifecycleTaskOverdue } from "@/src/modules/hr/lib/lifecycle-progress";
import {
  resolveOffboardingTaskAction,
  resolveOnboardingTaskAction,
} from "@/src/modules/hr/lib/lifecycle-task-actions";

const idle: LifecycleActionState = { status: "idle", message: "" };

type TaskRow = {
  id: string;
  code: string;
  label: string;
  status: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  notes?: string | null;
};

type CaseRow = {
  id: string;
  status: string;
  caseNumber?: string | null;
  caseType?: string | null;
  reasonCode?: string | null;
  reason?: string | null;
  progressPercent?: number;
  tasks: TaskRow[];
};

const OFFBOARDING_REASONS = [
  { value: "RESIGNATION", label: "Resignation" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "END_OF_CONTRACT", label: "End of contract" },
  { value: "TERMINATION", label: "Termination" },
  { value: "REDUNDANCY", label: "Redundancy" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "OTHER", label: "Other" },
] as const;

function progressLabel(caseRow: CaseRow): string {
  if (typeof caseRow.progressPercent === "number") {
    return `${caseRow.progressPercent}%`;
  }
  const total = caseRow.tasks.length;
  if (total === 0) return "0%";
  const done = caseRow.tasks.filter(
    (task) => task.status === "COMPLETED" || task.status === "SKIPPED",
  ).length;
  return `${Math.round((done / total) * 100)}%`;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-TT", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function dueDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function TaskMeta({ task }: { task: TaskRow }) {
  const overdue =
    task.dueAt != null &&
    isLifecycleTaskOverdue({
      status: task.status,
      dueAt: new Date(task.dueAt),
    });

  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {task.assigneeName ? <span>Assignee: {task.assigneeName}</span> : null}
      {task.dueAt ? (
        <span className={overdue ? "font-medium text-destructive" : undefined}>
          Due {formatDueDate(task.dueAt)}
          {overdue ? " · overdue" : ""}
        </span>
      ) : null}
    </span>
  );
}

function TaskManageForms({
  kind,
  employeeId,
  task,
  assignAction,
  assignPending,
  dueAction,
  duePending,
  blockAction,
  blockPending,
}: {
  kind: "onboarding" | "offboarding";
  employeeId: string;
  task: TaskRow;
  assignAction: (payload: FormData) => void;
  assignPending: boolean;
  dueAction: (payload: FormData) => void;
  duePending: boolean;
  blockAction: (payload: FormData) => void;
  blockPending: boolean;
}) {
  const open =
    task.status === "PENDING" ||
    task.status === "IN_PROGRESS" ||
    task.status === "BLOCKED";

  if (!open) {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <form action={assignAction} className="flex items-end gap-1">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="assigneeUserId" value="me" />
        <Button type="submit" size="sm" variant="ghost" disabled={assignPending}>
          {assignPending ? "…" : "Assign to me"}
        </Button>
      </form>
      <form action={dueAction} className="flex items-end gap-1">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="kind" value={kind} />
        <label className="space-y-0.5 text-xs">
          <span className="sr-only">Due date</span>
          <Input
            type="date"
            name="dueAt"
            defaultValue={dueDateInputValue(task.dueAt)}
            className="h-8 w-36"
          />
        </label>
        <Button type="submit" size="sm" variant="ghost" disabled={duePending}>
          Set due
        </Button>
      </form>
      {task.status !== "BLOCKED" ? (
        <form action={blockAction} className="flex items-end gap-1">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="kind" value={kind} />
          <Input
            name="reason"
            placeholder="Block reason"
            className="h-8 w-40"
            required
          />
          <Button type="submit" size="sm" variant="ghost" disabled={blockPending}>
            Block
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function EmployeeLifecyclePanel({
  employeeId,
  canManage,
  onboarding,
  offboarding,
  activatableContractId = null,
  currentContractId = null,
}: {
  employeeId: string;
  canManage: boolean;
  onboarding: CaseRow[];
  offboarding: CaseRow[];
  activatableContractId?: string | null;
  currentContractId?: string | null;
}) {
  const [startOnState, startOnAction, startOnPending] = useActionState(
    startEmployeeOnboarding,
    idle,
  );
  const [startOffState, startOffAction, startOffPending] = useActionState(
    startEmployeeOffboarding,
    idle,
  );
  const [onTaskState, onTaskAction, onTaskPending] = useActionState(
    markOnboardingTaskComplete,
    idle,
  );
  const [offTaskState, offTaskAction, offTaskPending] = useActionState(
    markOffboardingTaskComplete,
    idle,
  );
  const [cancelOnState, cancelOnAction, cancelOnPending] = useActionState(
    cancelEmployeeOnboarding,
    idle,
  );
  const [cancelOffState, cancelOffAction, cancelOffPending] = useActionState(
    cancelEmployeeOffboarding,
    idle,
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignEmployeeLifecycleTask,
    idle,
  );
  const [dueState, dueAction, duePending] = useActionState(
    setEmployeeLifecycleTaskDueDate,
    idle,
  );
  const [blockState, blockAction, blockPending] = useActionState(
    blockEmployeeLifecycleTask,
    idle,
  );
  const [finalPayNotes, setFinalPayNotes] = useState("");

  useEffect(() => {
    for (const state of [
      startOnState,
      startOffState,
      onTaskState,
      offTaskState,
      cancelOnState,
      cancelOffState,
      assignState,
      dueState,
      blockState,
    ]) {
      if (state.status === "success") toast.success(state.message);
      if (state.status === "error" && state.message) toast.error(state.message);
    }
  }, [
    startOnState,
    startOffState,
    onTaskState,
    offTaskState,
    cancelOnState,
    cancelOffState,
    assignState,
    dueState,
    blockState,
  ]);

  if (!canManage) {
    return null;
  }

  const openOnboarding = onboarding.find(
    (row) => row.status === "OPEN" || row.status === "READY",
  );
  const openOffboarding = offboarding.find(
    (row) => row.status === "OPEN" || row.status === "CLEARED",
  );

  return (
    <section className="space-y-4 border-y border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Hire / exit lifecycle
        </h2>
        <Button
          nativeButton={false}
          size="sm"
          variant="ghost"
          render={<Link href="/people/lifecycle" />}
        >
          Org queue
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {!openOnboarding ? (
          <form action={startOnAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="employeeId" value={employeeId} />
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Proposed start</span>
              <Input type="date" name="proposedStartDate" className="h-8 w-40" />
            </label>
            <Button type="submit" variant="outline" disabled={startOnPending}>
              {startOnPending ? "Opening…" : "Start onboarding"}
            </Button>
          </form>
        ) : null}
        {!openOffboarding ? (
          <form action={startOffAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="employeeId" value={employeeId} />
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Reason</span>
              <select
                name="reasonCode"
                defaultValue="RESIGNATION"
                className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {OFFBOARDING_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Last working day</span>
              <Input type="date" name="lastWorkingDate" className="h-8 w-40" />
            </label>
            <Button type="submit" variant="outline" disabled={startOffPending}>
              {startOffPending ? "Opening…" : "Start offboarding"}
            </Button>
          </form>
        ) : null}
      </div>

      {openOnboarding ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Onboarding
              {openOnboarding.caseNumber
                ? ` · ${openOnboarding.caseNumber}`
                : ""}{" "}
              · {openOnboarding.status}
              {openOnboarding.caseType
                ? ` · ${openOnboarding.caseType.replaceAll("_", " ")}`
                : ""}{" "}
              · {progressLabel(openOnboarding)}
            </p>
            <form action={cancelOnAction}>
              <input type="hidden" name="employeeId" value={employeeId} />
              <input type="hidden" name="caseId" value={openOnboarding.id} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={cancelOnPending}
              >
                {cancelOnPending ? "Cancelling…" : "Cancel onboarding"}
              </Button>
            </form>
          </div>
          <ul className="space-y-3">
            {openOnboarding.tasks.map((task) => {
              const action = resolveOnboardingTaskAction(task.code, employeeId, {
                activatableContractId,
                currentContractId,
              });
              const open =
                task.status === "PENDING" ||
                task.status === "IN_PROGRESS" ||
                task.status === "BLOCKED";
              const overdue =
                task.dueAt != null &&
                isLifecycleTaskOverdue({
                  status: task.status,
                  dueAt: new Date(task.dueAt),
                });

              return (
                <li
                  key={task.id}
                  className={`space-y-2 text-sm ${overdue ? "rounded-md border border-destructive/40 bg-destructive/5 p-2" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      {task.label}{" "}
                      <span className="text-muted-foreground">
                        ({task.status})
                      </span>
                      <TaskMeta task={task} />
                      {task.notes ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {task.notes}
                        </span>
                      ) : null}
                    </span>
                    {open && task.status !== "BLOCKED" ? (
                      <div className="flex flex-wrap gap-2">
                        {action ? (
                          <Button
                            nativeButton={false}
                            size="sm"
                            variant="outline"
                            render={<Link href={action.href} />}
                          >
                            {action.label}
                          </Button>
                        ) : null}
                        <form action={onTaskAction}>
                          <input
                            type="hidden"
                            name="employeeId"
                            value={employeeId}
                          />
                          <input type="hidden" name="taskId" value={task.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            disabled={onTaskPending}
                          >
                            Mark done
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <TaskManageForms
                    kind="onboarding"
                    employeeId={employeeId}
                    task={task}
                    assignAction={assignAction}
                    assignPending={assignPending}
                    dueAction={dueAction}
                    duePending={duePending}
                    blockAction={blockAction}
                    blockPending={blockPending}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {openOffboarding ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Offboarding
              {openOffboarding.caseNumber
                ? ` · ${openOffboarding.caseNumber}`
                : ""}{" "}
              · {openOffboarding.status}
              {openOffboarding.reasonCode
                ? ` · ${openOffboarding.reasonCode.replaceAll("_", " ")}`
                : ""}{" "}
              · {progressLabel(openOffboarding)}
            </p>
            <form action={cancelOffAction}>
              <input type="hidden" name="employeeId" value={employeeId} />
              <input type="hidden" name="caseId" value={openOffboarding.id} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={cancelOffPending}
              >
                {cancelOffPending ? "Cancelling…" : "Cancel offboarding"}
              </Button>
            </form>
          </div>
          <ul className="space-y-3">
            {openOffboarding.tasks.map((task) => {
              const action = resolveOffboardingTaskAction(task.code, employeeId, {
                currentContractId,
              });
              const open =
                task.status === "PENDING" ||
                task.status === "IN_PROGRESS" ||
                task.status === "BLOCKED";
              const needsFinalNote = task.code === "FINAL_PAY_CHECK";
              const overdue =
                task.dueAt != null &&
                isLifecycleTaskOverdue({
                  status: task.status,
                  dueAt: new Date(task.dueAt),
                });

              return (
                <li
                  key={task.id}
                  className={`space-y-2 text-sm ${overdue ? "rounded-md border border-destructive/40 bg-destructive/5 p-2" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      {task.label}{" "}
                      <span className="text-muted-foreground">
                        ({task.status})
                      </span>
                      <TaskMeta task={task} />
                      {task.notes ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {task.notes}
                        </span>
                      ) : null}
                    </span>
                    {open && task.status !== "BLOCKED" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {action ? (
                          <Button
                            nativeButton={false}
                            size="sm"
                            variant="outline"
                            render={<Link href={action.href} />}
                          >
                            {action.label}
                          </Button>
                        ) : null}
                        {needsFinalNote ? (
                          <Input
                            value={finalPayNotes}
                            onChange={(event) =>
                              setFinalPayNotes(event.target.value)
                            }
                            placeholder="Final pay confirmation note"
                            className="h-8 w-56"
                          />
                        ) : null}
                        <form action={offTaskAction}>
                          <input
                            type="hidden"
                            name="employeeId"
                            value={employeeId}
                          />
                          <input type="hidden" name="taskId" value={task.id} />
                          {needsFinalNote ? (
                            <input
                              type="hidden"
                              name="notes"
                              value={finalPayNotes}
                            />
                          ) : null}
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            disabled={offTaskPending}
                          >
                            Mark done
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <TaskManageForms
                    kind="offboarding"
                    employeeId={employeeId}
                    task={task}
                    assignAction={assignAction}
                    assignPending={assignPending}
                    dueAction={dueAction}
                    duePending={duePending}
                    blockAction={blockAction}
                    blockPending={blockPending}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
