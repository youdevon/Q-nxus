"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelEmployeeOffboarding,
  cancelEmployeeOnboarding,
  markOffboardingTaskComplete,
  markOnboardingTaskComplete,
  startEmployeeOffboarding,
  startEmployeeOnboarding,
  type LifecycleActionState,
} from "@/src/modules/hr/actions/manage-employee-lifecycle";

const idle: LifecycleActionState = { status: "idle", message: "" };

type TaskRow = {
  id: string;
  code: string;
  label: string;
  status: string;
};

type CaseRow = {
  id: string;
  status: string;
  tasks: TaskRow[];
};

export function EmployeeLifecyclePanel({
  employeeId,
  canManage,
  onboarding,
  offboarding,
}: {
  employeeId: string;
  canManage: boolean;
  onboarding: CaseRow[];
  offboarding: CaseRow[];
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

  useEffect(() => {
    for (const state of [
      startOnState,
      startOffState,
      onTaskState,
      offTaskState,
      cancelOnState,
      cancelOffState,
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
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        Hire / exit lifecycle
      </h2>

      <div className="flex flex-wrap gap-2">
        {!openOnboarding ? (
          <form action={startOnAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <Button type="submit" variant="outline" disabled={startOnPending}>
              {startOnPending ? "Opening…" : "Start onboarding"}
            </Button>
          </form>
        ) : null}
        {!openOffboarding ? (
          <form action={startOffAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
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
              Onboarding · {openOnboarding.status}
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
          <ul className="space-y-2">
            {openOnboarding.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {task.label}{" "}
                  <span className="text-muted-foreground">({task.status})</span>
                </span>
                {task.status === "PENDING" || task.status === "IN_PROGRESS" ? (
                  <form action={onTaskAction}>
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={onTaskPending}
                    >
                      Mark done
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {openOffboarding ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Offboarding · {openOffboarding.status}
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
          <ul className="space-y-2">
            {openOffboarding.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {task.label}{" "}
                  <span className="text-muted-foreground">({task.status})</span>
                </span>
                {task.status === "PENDING" || task.status === "IN_PROGRESS" ? (
                  <form action={offTaskAction}>
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={offTaskPending}
                    >
                      Mark done
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
