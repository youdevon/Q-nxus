"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Landmark, Plus, Save, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import {
  saveNisClassZRateVersion,
  saveNisEligibilityConfigVersion,
  seedDefaultNisClassZRates,
  type NisClassZFormState,
  type NisEligibilityFormState,
} from "@/src/modules/payroll/actions/manage-nis-class-z";
import {
  computeNisClassZContribution,
  toNisClassZRateInputs,
  type NisClassZRateRecord,
  type NisClassZVersionSummary,
} from "@/src/modules/payroll/lib/nis-class-z";
import { NIS_CLASS_I_MONTHLY_MIN } from "@/src/modules/payroll/lib/nis-contribution";
import type { NisEligibilityVersionSummary } from "@/src/modules/payroll/data/get-nis-eligibility-config";
import { PayrollNav } from "./payroll-nav";

const rateInitialState: NisClassZFormState = {
  status: "idle",
  message: "",
};

const eligibilityInitialState: NisEligibilityFormState = {
  status: "idle",
  message: "",
};

type EditableBandRow = {
  monthlyMin: string;
  monthlyMax: string;
  employerWeeklyAmount: string;
};

function toEditableBands(rates: NisClassZRateRecord[]): EditableBandRow[] {
  return rates.map((row) => ({
    monthlyMin: row.monthlyMin,
    monthlyMax: row.monthlyMax ?? "",
    employerWeeklyAmount: row.employerWeeklyAmount,
  }));
}

function addBandRow(rows: EditableBandRow[]): EditableBandRow[] {
  const last = rows.at(-1);
  const nextMin =
    last?.monthlyMax && last.monthlyMax.trim() !== ""
      ? (Number(last.monthlyMax) + 0.01).toFixed(2)
      : String(NIS_CLASS_I_MONTHLY_MIN);

  return [
    ...rows,
    {
      monthlyMin: nextMin,
      monthlyMax: "",
      employerWeeklyAmount: "",
    },
  ];
}

export function NisClassZRateForm({
  rates,
  effectiveFrom,
  effectiveTo,
  versionLabel,
  isActive,
  sourceEffectiveFrom,
  canManage,
}: {
  rates: NisClassZRateRecord[];
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  sourceEffectiveFrom?: string | null;
  canManage: boolean;
}) {
  const isNewVersion = sourceEffectiveFrom != null;
  const [state, formAction, pending] = useActionState(
    saveNisClassZRateVersion,
    rateInitialState,
  );
  const [rows, setRows] = useState<EditableBandRow[]>(() => toEditableBands(rates));

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const bandsJson = JSON.stringify(
    rows.map((row) => ({
      monthlyMin: row.monthlyMin.trim(),
      monthlyMax: row.monthlyMax.trim() === "" ? null : row.monthlyMax.trim(),
      employerWeeklyAmount: row.employerWeeklyAmount.trim(),
    })),
  );

  const previewContribution = useMemo(() => {
    const parsed = toNisClassZRateInputs(
      rows
        .filter((row) => row.monthlyMin && row.employerWeeklyAmount)
        .map((row, index) => ({
          id: `preview-${index}`,
          monthlyMin: row.monthlyMin,
          monthlyMax: row.monthlyMax || null,
          employerWeeklyAmount: row.employerWeeklyAmount,
          effectiveFrom,
          effectiveTo,
          versionLabel,
          isActive,
          notes: null,
        })),
    );

    return computeNisClassZContribution({
      monthlySalary: 30_000,
      rates: parsed,
      weeksInPeriod: 4,
    });
  }, [rows, effectiveFrom, effectiveTo, versionLabel, isActive]);

  function updateRow(index: number, changes: Partial<EditableBandRow>) {
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

        <input type="hidden" name="bandsJson" value={bandsJson} />

        <PageHeader
          title={
            isNewVersion
              ? "New Class Z Rate Schedule"
              : "Edit Class Z Rate Schedule"
          }
          description="Employer-only injury coverage (Class Z) — fixed weekly amounts by monthly earnings band. No employee deduction."
          backHref="/payroll/settings/nis/class-z"
          backLabel="Class Z settings"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/nis/class-z">
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
              • Earnings below TTD {NIS_CLASS_I_MONTHLY_MIN}/month — no Class Z
              contribution.
            </li>
            <li>
              • Period employer amount = weekly amount × Mondays in the pay
              period (4 or 5 contribution weeks).
            </li>
            <li>
              • Preview at TTD 30,000/month (4 weeks) → employer{" "}
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
              <SectionHeading>Earnings bands</SectionHeading>
            </div>

            {canManage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows((current) => addBandRow(current))}
              >
                <Plus />
                Add band
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Monthly min (TTD)</th>
                  <th className="py-2 pr-3 font-medium">Monthly max (TTD)</th>
                  <th className="py-2 font-medium">Employer / week</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`band-${index}`} className="border-b border-border/50">
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

export function NisEligibilityConfigForm({
  config,
  sourceEffectiveFrom,
  canManage,
}: {
  config: {
    effectiveFrom: string;
    effectiveTo: string | null;
    versionLabel: string | null;
    notes: string | null;
    isActive: boolean;
    fullRetirementAge: number;
    earlyRetirementAge: number;
  };
  sourceEffectiveFrom?: string | null;
  canManage: boolean;
}) {
  const isNewVersion = sourceEffectiveFrom != null;
  const [state, formAction, pending] = useActionState(
    saveNisEligibilityConfigVersion,
    eligibilityInitialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

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

        <PageHeader
          title={
            isNewVersion
              ? "New Eligibility Thresholds"
              : "Edit Eligibility Thresholds"
          }
          description="Age thresholds for automatic Class Z assignment — early retirement (60) and full retirement (65) by default."
          backHref="/payroll/settings/nis/class-z"
          backLabel="Class Z settings"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/nis/class-z">
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save thresholds"}
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
              defaultValue={config.effectiveFrom}
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
              defaultValue={config.effectiveTo ?? ""}
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
              defaultValue={config.versionLabel ?? ""}
              placeholder="e.g. 2026"
              readOnly={!canManage}
              disabled={!canManage}
            />
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={config.isActive}
              disabled={!canManage}
            />
            Active
          </label>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="earlyRetirementAge">
              Early retirement age
            </label>
            <Input
              id="earlyRetirementAge"
              name="earlyRetirementAge"
              type="number"
              min={50}
              max={100}
              defaultValue={config.earlyRetirementAge}
              required
              readOnly={!canManage}
              disabled={!canManage}
            />
            {state.fieldErrors?.earlyRetirementAge && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.earlyRetirementAge}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Employees at or above this age (with NIS retirement benefit) move
              to Class Z.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fullRetirementAge">
              Full retirement age
            </label>
            <Input
              id="fullRetirementAge"
              name="fullRetirementAge"
              type="number"
              min={50}
              max={100}
              defaultValue={config.fullRetirementAge}
              required
              readOnly={!canManage}
              disabled={!canManage}
            />
            {state.fieldErrors?.fullRetirementAge && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.fullRetirementAge}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Employees at or above this age are exempt from NIS contributions.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium" htmlFor="notes">
            Notes (optional)
          </label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={config.notes ?? ""}
            rows={3}
            readOnly={!canManage}
            disabled={!canManage}
          />
        </section>
      </PageShell>
    </form>
  );
}

function SeedClassZButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await seedDefaultNisClassZRates();
          if (result.ok) {
            toast.success(result.message);
          } else {
            toast.error(result.message);
          }
        });
      }}
    >
      <Sparkles />
      {pending ? "Loading…" : "Load 2026 defaults"}
    </Button>
  );
}

export function NisClassZDirectory({
  rateVersions,
  rates,
  selectedRatesVersion,
  eligibilityVersions,
  selectedEligibilityVersion,
  canManage,
}: {
  rateVersions: NisClassZVersionSummary[];
  rates: NisClassZRateRecord[];
  selectedRatesVersion: string | null;
  eligibilityVersions: NisEligibilityVersionSummary[];
  selectedEligibilityVersion: string | null;
  canManage: boolean;
}) {
  const selectedRateVersion =
    rateVersions.find(
      (version) => version.effectiveFrom === selectedRatesVersion,
    ) ??
    rateVersions.find((version) => version.isCurrent) ??
    rateVersions[0] ??
    null;

  const selectedEligibility =
    eligibilityVersions.find(
      (version) => version.effectiveFrom === selectedEligibilityVersion,
    ) ??
    eligibilityVersions.find((version) => version.isCurrent) ??
    eligibilityVersions[0] ??
    null;

  const classZPreview = useMemo(() => {
    return computeNisClassZContribution({
      monthlySalary: 30_000,
      rates: toNisClassZRateInputs(rates),
      weeksInPeriod: 4,
    });
  }, [rates]);

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="NIS Class Z"
        description="Employer-only injury coverage for retired employees and age-based eligibility thresholds."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
        actions={
          canManage && selectedRateVersion ? (
            <div className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/payroll/settings/nis/class-z/${selectedRateVersion.effectiveFrom}/edit`}
                  />
                }
              >
                Edit rates
              </Button>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/payroll/settings/nis/class-z/new?copyFrom=${selectedRateVersion.effectiveFrom}`}
                  />
                }
              >
                <Copy />
                New rate version
              </Button>
            </div>
          ) : canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/payroll/settings/nis/class-z/new" />}
              >
                <Plus />
                New rate schedule
              </Button>
              <SeedClassZButton />
            </div>
          ) : undefined
        }
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          <SectionHeading>Employer rate bands</SectionHeading>
        </div>

        {rateVersions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No Class Z rate schedules configured yet.
            </p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  nativeButton={false}
                  render={<Link href="/payroll/settings/nis/class-z/new" />}
                >
                  <Plus />
                  Create schedule
                </Button>
                <SeedClassZButton />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <section className="flex flex-wrap gap-2">
              {rateVersions.map((version) => (
                <Link
                  key={version.effectiveFrom}
                  href={`/payroll/settings/nis/class-z?ratesVersion=${version.effectiveFrom}`}
                  className={[
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    selectedRateVersion?.effectiveFrom === version.effectiveFrom
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/70 hover:bg-muted/40",
                  ].join(" ")}
                >
                  <span>{version.versionLabel ?? version.effectiveFrom}</span>
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

            {selectedRateVersion ? (
              <section className="mt-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <SectionHeading>
                    {selectedRateVersion.versionLabel ?? "Schedule"} —{" "}
                    {selectedRateVersion.bandCount} bands
                  </SectionHeading>
                  <Badge
                    variant={selectedRateVersion.isActive ? "success" : "outline"}
                  >
                    {selectedRateVersion.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  Example — TTD 30,000/mo (4 weeks): employer{" "}
                  {formatMoney(classZPreview.employerMonthly, {
                    currency: "TTD",
                  })}
                  /mo
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">
                          Monthly earnings
                        </th>
                        <th className="py-2 pr-4 font-medium">Employer / week</th>
                        <th className="py-2 font-medium">Employer / 4 wks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((row) => {
                        const employerMonthly =
                          Math.round(
                            Number(row.employerWeeklyAmount) * 4 * 100,
                          ) / 100;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-border/50"
                          >
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {formatMoney(row.monthlyMin)} –{" "}
                              {row.monthlyMax
                                ? formatMoney(row.monthlyMax)
                                : "and over"}
                            </td>
                            <td className="py-2.5 pr-4">
                              {formatMoney(row.employerWeeklyAmount, {
                                currency: "TTD",
                              })}
                            </td>
                            <td className="py-2.5">
                              {formatMoney(employerMonthly, {
                                currency: "TTD",
                              })}
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
      </section>

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <SectionHeading>Eligibility thresholds</SectionHeading>
          </div>

          {canManage && selectedEligibility ? (
            <div className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/payroll/settings/nis/class-z/eligibility/${selectedEligibility.effectiveFrom}/edit`}
                  />
                }
              >
                Edit thresholds
              </Button>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/payroll/settings/nis/class-z/eligibility/new?copyFrom=${selectedEligibility.effectiveFrom}`}
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
              render={
                <Link href="/payroll/settings/nis/class-z/eligibility/new" />
              }
            >
              <Plus />
              Add thresholds
            </Button>
          ) : null}
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Used with employee date of birth and retirement-benefit flag to assign
          NORMAL, CLASS_Z, or EXEMPT NIS categories automatically.
        </p>

        {eligibilityVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligibility thresholds configured — defaults (60 / 65) apply.
          </p>
        ) : (
          <>
            <section className="flex flex-wrap gap-2">
              {eligibilityVersions.map((version) => (
                <Link
                  key={version.effectiveFrom}
                  href={`/payroll/settings/nis/class-z?eligibilityVersion=${version.effectiveFrom}`}
                  className={[
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    selectedEligibility?.effectiveFrom === version.effectiveFrom
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/70 hover:bg-muted/40",
                  ].join(" ")}
                >
                  <span>{version.versionLabel ?? version.effectiveFrom}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {version.earlyRetirementAge} / {version.fullRetirementAge}
                  </span>
                  {version.isCurrent ? (
                    <Badge variant="success" className="ml-2">
                      In effect
                    </Badge>
                  ) : null}
                </Link>
              ))}
            </section>

            {selectedEligibility ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Early retirement age
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {selectedEligibility.earlyRetirementAge}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Full retirement age
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {selectedEligibility.fullRetirementAge}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Effective from</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedEligibility.effectiveFrom}
                    {selectedEligibility.effectiveTo
                      ? ` – ${selectedEligibility.effectiveTo}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </PageShell>
  );
}
