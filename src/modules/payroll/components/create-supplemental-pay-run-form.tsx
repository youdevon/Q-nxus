"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Save, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  createSupplementalPayRun,
  type PayRunFormState,
} from "@/src/modules/payroll/actions/manage-pay-run";
import { PayrollNav } from "./payroll-nav";

const initialState: PayRunFormState = {
  status: "idle",
  message: "",
};

export type SupplementalEmployeeOption = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  isReady: boolean;
  wasInSourceRun: boolean;
};

export function CreateSupplementalPayRunForm({
  sourcePayRunId,
  sourceRunNumber,
  periodName,
  defaultRunKind,
  employees,
}: {
  sourcePayRunId: string;
  sourceRunNumber: string;
  periodName: string;
  defaultRunKind: "CORRECTION" | "OFF_CYCLE";
  employees: SupplementalEmployeeOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createSupplementalPayRun,
    initialState,
  );
  const [runKind, setRunKind] = useState<"CORRECTION" | "OFF_CYCLE">(
    defaultRunKind,
  );
  const readyEmployees = useMemo(
    () => employees.filter((row) => row.isReady),
    [employees],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        readyEmployees
          .filter((row) => row.wasInSourceRun)
          .map((row) => row.employeeId),
      ),
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  function toggle(employeeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }

  function selectAllReady() {
    setSelected(new Set(readyEmployees.map((row) => row.employeeId)));
  }

  function selectSourceOnly() {
    setSelected(
      new Set(
        readyEmployees
          .filter((row) => row.wasInSourceRun)
          .map((row) => row.employeeId),
      ),
    );
  }

  const kindLabel = runKind === "CORRECTION" ? "Correction" : "Off-cycle";

  return (
    <form action={formAction}>
      <input type="hidden" name="sourcePayRunId" value={sourcePayRunId} />
      <input type="hidden" name="runKind" value={runKind} />
      {[...selected].map((employeeId) => (
        <input
          key={employeeId}
          type="hidden"
          name="employeeIds"
          value={employeeId}
        />
      ))}

      <PageShell>
        <PayrollNav />

        <PageHeader
          title={`New ${kindLabel.toLowerCase()} run`}
          description={`${periodName} · sourced from posted run ${sourceRunNumber}. Creates a new draft with its own payslips — the original posted run is not changed.`}
          backHref={`/payroll/runs/${sourcePayRunId}`}
          backLabel="Source pay run"
          actions={
            <FormPageActions cancelHref={`/payroll/runs/${sourcePayRunId}`}>
              <Button
                type="submit"
                disabled={pending || selected.size === 0}
              >
                <Save />
                {pending ? "Creating…" : `Create ${kindLabel.toLowerCase()} draft`}
              </Button>
            </FormPageActions>
          }
        />

        {state.status === "error" ? (
          <div
            role="alert"
            className="whitespace-pre-line border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <SectionHeading>Run type</SectionHeading>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="runKindUi"
                checked={runKind === "CORRECTION"}
                onChange={() => setRunKind("CORRECTION")}
              />
              Correction
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="runKindUi"
                checked={runKind === "OFF_CYCLE"}
                onChange={() => setRunKind("OFF_CYCLE")}
              />
              Off-cycle
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Both kinds freeze snapshots on post. Use correction for fixing a
            posted period; off-cycle for ad-hoc payments in the same period.
          </p>
          {state.fieldErrors?.runKind ? (
            <p className="mt-1 text-xs text-destructive">
              {state.fieldErrors.runKind}
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionHeading>Employees</SectionHeading>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={selectSourceOnly}
              >
                Source run only
              </button>
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={selectAllReady}
              >
                All ready
              </button>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {selected.size} selected · only payroll-ready employees can be
            included.
          </p>
          {state.fieldErrors?.employeeIds ? (
            <p className="mb-3 text-xs text-destructive">
              {state.fieldErrors.employeeIds}
            </p>
          ) : null}

          <div className="divide-y divide-border/70">
            {employees.map((row) => {
              const disabled = !row.isReady;
              const checked = selected.has(row.employeeId);

              return (
                <label
                  key={row.employeeId}
                  className={`flex cursor-pointer items-start gap-3 py-3 ${
                    disabled ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(row.employeeId)}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.displayName}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {row.employeeNumber}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.departmentName ?? "Unassigned"}
                      {row.wasInSourceRun ? " · in source run" : ""}
                      {!row.isReady ? " · not ready" : ""}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeading>Notes</SectionHeading>
          <Textarea
            name="notes"
            className="mt-3"
            rows={3}
            placeholder="Optional reason for this correction or off-cycle run"
          />
        </section>
      </PageShell>
    </form>
  );
}
