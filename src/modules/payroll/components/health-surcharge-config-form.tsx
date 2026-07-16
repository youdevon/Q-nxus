"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Copy, HeartPulse, Plus, Save } from "lucide-react";
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
  saveHealthSurchargeConfig,
  type HealthSurchargeFormState,
} from "@/src/modules/payroll/actions/manage-health-surcharge-config";
import type { HealthSurchargeConfigRecord } from "@/src/modules/payroll/lib/health-surcharge";
import { PayrollNav } from "./payroll-nav";

const initialState: HealthSurchargeFormState = {
  status: "idle",
  message: "",
};

export function HealthSurchargeConfigForm({
  config,
  sourceId,
  canManage,
}: {
  config?: HealthSurchargeConfigRecord | null;
  sourceId?: string | null;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveHealthSurchargeConfig,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>
        <PayrollNav />

        {config?.id && !sourceId ? (
          <input type="hidden" name="id" value={config.id} />
        ) : null}
        {sourceId ? <input type="hidden" name="sourceId" value={sourceId} /> : null}

        <PageHeader
          title={
            config && !sourceId
              ? "Edit Health Surcharge"
              : "New Health Surcharge Config"
          }
          description="Fixed weekly amounts by earnings tier — not a percentage of salary. Exempt under 16, age 60+, or pension-only income."
          backHref="/payroll/settings/health"
          backLabel="Health Surcharge"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/health">
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save config"}
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

        <section>
          <div className="mb-4 flex items-center gap-2">
            <HeartPulse className="size-4 text-muted-foreground" />
            <SectionHeading>Schedule</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="effectiveFrom">
                Effective from
              </label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                defaultValue={
                  sourceId
                    ? new Date().toISOString().slice(0, 10)
                    : (config?.effectiveFrom ?? "")
                }
                required
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="effectiveTo">
                Effective to (optional)
              </label>
              <Input
                id="effectiveTo"
                name="effectiveTo"
                type="date"
                defaultValue={sourceId ? "" : (config?.effectiveTo ?? "")}
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
                defaultValue={sourceId ? "" : (config?.versionLabel ?? "")}
                placeholder="e.g. 2026"
                disabled={!canManage}
              />
            </div>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={config?.isActive ?? true}
                disabled={!canManage}
              />
              Active
            </label>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="higherWeeklyAmount">
                Higher weekly amount (TTD)
              </label>
              <Input
                id="higherWeeklyAmount"
                name="higherWeeklyAmount"
                type="number"
                min={0}
                step={0.01}
                defaultValue={config?.higherWeeklyAmount ?? "8.25"}
                required
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="lowerWeeklyAmount">
                Lower weekly amount (TTD)
              </label>
              <Input
                id="lowerWeeklyAmount"
                name="lowerWeeklyAmount"
                type="number"
                min={0}
                step={0.01}
                defaultValue={config?.lowerWeeklyAmount ?? "4.80"}
                required
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="weeklyEarningsThreshold"
              >
                Weekly earnings threshold
              </label>
              <Input
                id="weeklyEarningsThreshold"
                name="weeklyEarningsThreshold"
                type="number"
                min={0}
                step={0.01}
                defaultValue={config?.weeklyEarningsThreshold ?? "109"}
                required
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Above this weekly amount → higher rate.
              </p>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="monthlyEarningsThreshold"
              >
                Monthly earnings threshold
              </label>
              <Input
                id="monthlyEarningsThreshold"
                name="monthlyEarningsThreshold"
                type="number"
                min={0}
                step={0.01}
                defaultValue={config?.monthlyEarningsThreshold ?? "469.99"}
                required
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Above this monthly amount → higher rate.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="underAgeExempt">
                Under-age exempt
              </label>
              <Input
                id="underAgeExempt"
                name="underAgeExempt"
                type="number"
                min={0}
                step={1}
                defaultValue={config?.underAgeExempt ?? 16}
                required
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="seniorAgeExempt">
                Senior age exempt (at or above)
              </label>
              <Input
                id="seniorAgeExempt"
                name="seniorAgeExempt"
                type="number"
                min={0}
                step={1}
                defaultValue={config?.seniorAgeExempt ?? 60}
                required
                disabled={!canManage}
              />
            </div>
          </div>
        </section>
      </PageShell>
    </form>
  );
}

export function HealthSurchargeDirectory({
  configs,
  canManage,
}: {
  configs: HealthSurchargeConfigRecord[];
  canManage: boolean;
}) {
  const current = configs.find((config) => config.isCurrent) ?? null;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Health Surcharge"
        description="Fixed weekly deduction by earnings tier, deducted separately from PAYE and NIS."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {current ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={`/payroll/settings/health/new?copyFrom=${current.id}`}
                    />
                  }
                >
                  <Copy />
                  New version
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                render={<Link href="/payroll/settings/health/new" />}
              >
                <Plus />
                New config
              </Button>
            </div>
          ) : undefined
        }
      />

      {configs.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No Health Surcharge configurations yet.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {configs.map((config) => (
            <div
              key={config.id}
              className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_10rem_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {config.versionLabel ?? config.effectiveFrom}
                  </p>
                  {config.isCurrent ? (
                    <Badge variant="success">In effect</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Higher {formatMoney(config.higherWeeklyAmount, { currency: "TTD" })}
                  /wk above {formatMoney(config.monthlyEarningsThreshold)}{" "}
                  monthly · Lower{" "}
                  {formatMoney(config.lowerWeeklyAmount, { currency: "TTD" })}
                  /wk · Exempt under {config.underAgeExempt} / ≥
                  {config.seniorAgeExempt}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Effective from</p>
                <p className="mt-1 text-sm font-medium">{config.effectiveFrom}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Effective to</p>
                <p className="mt-1 text-sm font-medium">
                  {config.effectiveTo ?? "Open-ended"}
                </p>
              </div>

              {canManage ? (
                <div className="flex items-center justify-end">
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={
                      <Link
                        href={`/payroll/settings/health/${config.id}/edit`}
                      />
                    }
                  >
                    Edit
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
