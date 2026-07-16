"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Landmark, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import {
  saveNisClassVersion,
  type NisClassFormState,
} from "@/src/modules/payroll/actions/manage-nis-classes";
import {
  computeNisContribution,
  NIS_CLASS_I_MONTHLY_MIN,
  NIS_WEEKS_PER_MONTH,
  toNisClassInputs,
  type NisEarningsClassRecord,
} from "@/src/modules/payroll/lib/nis-contribution";
import { PayrollNav } from "./payroll-nav";

const initialState: NisClassFormState = {
  status: "idle",
  message: "",
};

type EditableClassRow = {
  classCode: string;
  monthlyMin: string;
  monthlyMax: string;
  employeeWeeklyAmount: string;
  employerWeeklyAmount: string;
};

function toEditableRows(classes: NisEarningsClassRecord[]): EditableClassRow[] {
  return classes.map((row) => ({
    classCode: row.classCode,
    monthlyMin: row.monthlyMin,
    monthlyMax: row.monthlyMax ?? "",
    employeeWeeklyAmount: row.employeeWeeklyAmount,
    employerWeeklyAmount: row.employerWeeklyAmount,
  }));
}

function addClassRow(rows: EditableClassRow[]): EditableClassRow[] {
  const nextIndex = rows.length + 1;
  const roman = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
  ][nextIndex - 1];

  return [
    ...rows,
    {
      classCode: roman ?? String(nextIndex),
      monthlyMin: "",
      monthlyMax: "",
      employeeWeeklyAmount: "",
      employerWeeklyAmount: "",
    },
  ];
}

export function NisClassForm({
  classes,
  effectiveFrom,
  effectiveTo,
  versionLabel,
  isActive,
  sourceEffectiveFrom,
  canManage,
}: {
  classes: NisEarningsClassRecord[];
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  sourceEffectiveFrom?: string | null;
  canManage: boolean;
}) {
  const isNewVersion = sourceEffectiveFrom != null;
  const [state, formAction, pending] = useActionState(
    saveNisClassVersion,
    initialState,
  );
  const [rows, setRows] = useState<EditableClassRow[]>(() =>
    toEditableRows(classes),
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const classesJson = JSON.stringify(
    rows.map((row) => ({
      classCode: row.classCode.trim(),
      monthlyMin: row.monthlyMin.trim(),
      monthlyMax: row.monthlyMax.trim() === "" ? null : row.monthlyMax.trim(),
      employeeWeeklyAmount: row.employeeWeeklyAmount.trim(),
      employerWeeklyAmount: row.employerWeeklyAmount.trim(),
    })),
  );

  const previewContribution = useMemo(() => {
    const parsed = toNisClassInputs(
      rows
        .filter((row) => row.monthlyMin && row.employeeWeeklyAmount)
        .map((row) => ({
          id: row.classCode,
          classCode: row.classCode,
          monthlyMin: row.monthlyMin,
          monthlyMax: row.monthlyMax || null,
          employeeWeeklyAmount: row.employeeWeeklyAmount,
          employerWeeklyAmount: row.employerWeeklyAmount,
          effectiveFrom,
          effectiveTo,
          versionLabel,
          isActive,
        })),
    );

    return computeNisContribution({
      monthlySalary: 30_000,
      classes: parsed,
    });
  }, [rows, effectiveFrom, effectiveTo, versionLabel, isActive]);

  function updateRow(index: number, changes: Partial<EditableClassRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row,
      ),
    );
  }

  return (
    <form action={formAction}>
      <PageShell size="lg">
        <PayrollNav />

        {sourceEffectiveFrom ? (
          <input
            type="hidden"
            name="sourceEffectiveFrom"
            value={sourceEffectiveFrom}
          />
        ) : null}

        <input type="hidden" name="classesJson" value={classesJson} />

        <PageHeader
          title={
            isNewVersion ? "New NIS Class Schedule" : "Edit NIS Class Schedule"
          }
          description="Fixed weekly employee and employer amounts by monthly earnings band. Monthly equivalents use 4⅓ weeks (13 ÷ 3)."
          backHref="/payroll/settings/nis"
          backLabel="NIS classes"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/nis">
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save schedule"}
                </Button>
              </FormPageActions>
            ) : undefined
          }
        />

        {state.status === "error" && (
          <div
            role="alert"
            className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="effectiveFrom">
              Effective from
            </label>
            <Input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              defaultValue={effectiveFrom}
              required
              readOnly={!canManage}
              disabled={!canManage}
            />
            {state.fieldErrors?.effectiveFrom && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.effectiveFrom}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="effectiveTo">
              Effective to (optional)
            </label>
            <Input
              id="effectiveTo"
              name="effectiveTo"
              type="date"
              defaultValue={effectiveTo ?? ""}
              readOnly={!canManage}
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="versionLabel">
              Version label
            </label>
            <Input
              id="versionLabel"
              name="versionLabel"
              defaultValue={versionLabel ?? ""}
              placeholder="e.g. 2026"
              readOnly={!canManage}
              disabled={!canManage}
            />
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={isActive}
              disabled={!canManage}
            />
            Active
          </label>
        </section>

        <section className="rounded-md border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Calculation notes</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              • Earnings below TTD {NIS_CLASS_I_MONTHLY_MIN}/month — no NIS
              contribution.
            </li>
            <li>
              • Monthly employee/employer amounts = weekly amount ×{" "}
              {NIS_WEEKS_PER_MONTH.toFixed(3)} weeks.
            </li>
            <li>
              • Preview at TTD 30,000/month → Class{" "}
              {previewContribution.classCode ?? "—"}: employee{" "}
              {formatMoney(previewContribution.employeeMonthly, {
                currency: "TTD",
              })}
              /mo, employer{" "}
              {formatMoney(previewContribution.employerMonthly, {
                currency: "TTD",
              })}
              /mo.
            </li>
          </ul>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-muted-foreground" />
              <SectionHeading>Earnings classes</SectionHeading>
            </div>

            {canManage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows((current) => addClassRow(current))}
              >
                <Plus />
                Add class
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Class</th>
                  <th className="py-2 pr-3 font-medium">Monthly min (TTD)</th>
                  <th className="py-2 pr-3 font-medium">Monthly max (TTD)</th>
                  <th className="py-2 pr-3 font-medium">Employee / week</th>
                  <th className="py-2 font-medium">Employer / week</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.classCode}-${index}`} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      {canManage ? (
                        <Input
                          value={row.classCode}
                          onChange={(event) =>
                            updateRow(index, { classCode: event.target.value })
                          }
                          className="w-20"
                          required
                        />
                      ) : (
                        row.classCode
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {canManage ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.monthlyMin}
                          onChange={(event) =>
                            updateRow(index, { monthlyMin: event.target.value })
                          }
                          required
                        />
                      ) : (
                        formatMoney(row.monthlyMin)
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {canManage ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.monthlyMax}
                          onChange={(event) =>
                            updateRow(index, { monthlyMax: event.target.value })
                          }
                          placeholder="Open-ended"
                        />
                      ) : row.monthlyMax ? (
                        formatMoney(row.monthlyMax)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {canManage ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.employeeWeeklyAmount}
                          onChange={(event) =>
                            updateRow(index, {
                              employeeWeeklyAmount: event.target.value,
                            })
                          }
                          required
                        />
                      ) : (
                        formatMoney(row.employeeWeeklyAmount)
                      )}
                    </td>
                    <td className="py-2">
                      {canManage ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.employerWeeklyAmount}
                          onChange={(event) =>
                            updateRow(index, {
                              employerWeeklyAmount: event.target.value,
                            })
                          }
                          required
                        />
                      ) : (
                        formatMoney(row.employerWeeklyAmount)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageShell>
    </form>
  );
}

export function NisClassesDirectory({
  versions,
  classes,
  selectedEffectiveFrom,
  canManage,
}: {
  versions: Array<{
    effectiveFrom: string;
    effectiveTo: string | null;
    versionLabel: string | null;
    isActive: boolean;
    isCurrent: boolean;
    classCount: number;
  }>;
  classes: NisEarningsClassRecord[];
  selectedEffectiveFrom: string | null;
  canManage: boolean;
}) {
  const selectedVersion =
    versions.find((version) => version.effectiveFrom === selectedEffectiveFrom) ??
    versions.find((version) => version.isCurrent) ??
    versions[0] ??
    null;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="NIS Earnings Classes"
        description="Trinidad & Tobago National Insurance — fixed weekly contributions by earnings class (not a flat salary percentage)."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
        actions={
          canManage && selectedVersion ? (
            <div className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/payroll/settings/nis/${selectedVersion.effectiveFrom}/edit`}
                  />
                }
              >
                Edit schedule
              </Button>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/payroll/settings/nis/new?copyFrom=${selectedVersion.effectiveFrom}`}
                  />
                }
              >
                <Copy />
                New version
              </Button>
            </div>
          ) : canManage ? (
            <Button
              nativeButton={false}
              render={<Link href="/payroll/settings/nis/new" />}
            >
              <Plus />
              New schedule
            </Button>
          ) : undefined
        }
      />

      {versions.length === 0 ? (
        <section className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No NIS earnings classes configured yet.
          </p>
          {canManage ? (
            <Button
              nativeButton={false}
              className="mt-4"
              render={<Link href="/payroll/settings/nis/new" />}
            >
              <Plus />
              Create first schedule
            </Button>
          ) : null}
        </section>
      ) : (
        <>
          <section className="flex flex-wrap gap-2">
            {versions.map((version) => (
              <Link
                key={version.effectiveFrom}
                href={`/payroll/settings/nis?version=${version.effectiveFrom}`}
                className={[
                  "rounded-md border px-3 py-2 text-sm transition-colors",
                  selectedVersion?.effectiveFrom === version.effectiveFrom
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border/70 hover:bg-muted/40",
                ].join(" ")}
              >
                <span>
                  {version.versionLabel ?? version.effectiveFrom}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  from {version.effectiveFrom}
                </span>
                {version.isCurrent ? (
                  <Badge variant="success" className="ml-2">
                    In effect
                  </Badge>
                ) : null}
              </Link>
            ))}
          </section>

          {selectedVersion ? (
            <section className="mt-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SectionHeading>
                  {selectedVersion.versionLabel ?? "Schedule"} —{" "}
                  {selectedVersion.classCount} classes
                </SectionHeading>
                <Badge variant={selectedVersion.isActive ? "success" : "outline"}>
                  {selectedVersion.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Class</th>
                      <th className="py-2 pr-4 font-medium">Monthly earnings</th>
                      <th className="py-2 pr-4 font-medium">Employee / week</th>
                      <th className="py-2 pr-4 font-medium">Employer / week</th>
                      <th className="py-2 font-medium">Employee / month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((row) => {
                      const employeeMonthly =
                        Math.round(
                          Number(row.employeeWeeklyAmount) *
                            NIS_WEEKS_PER_MONTH *
                            100,
                        ) / 100;

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-border/50"
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            {row.classCode}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {formatMoney(row.monthlyMin)} –{" "}
                            {row.monthlyMax
                              ? formatMoney(row.monthlyMax)
                              : "and over"}
                          </td>
                          <td className="py-2.5 pr-4">
                            {formatMoney(row.employeeWeeklyAmount, {
                              currency: "TTD",
                            })}
                          </td>
                          <td className="py-2.5 pr-4">
                            {formatMoney(row.employerWeeklyAmount, {
                              currency: "TTD",
                            })}
                          </td>
                          <td className="py-2.5">
                            {formatMoney(employeeMonthly, { currency: "TTD" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
