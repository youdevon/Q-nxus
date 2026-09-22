"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Copy, Gift, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  saveGratuityPolicy,
  type GratuityPolicyFormState,
} from "@/src/modules/payroll/actions/manage-gratuity-policy";
import type { GratuityPolicyRecord } from "@/src/modules/payroll/data/get-gratuity-policy";
import { PayrollNav } from "./payroll-nav";

const initialState: GratuityPolicyFormState = {
  status: "idle",
  message: "",
};

const DEFAULT_TAX_BANDS_JSON = `[
  {"upToAmount":1000000,"ratePercent":25},
  {"upToAmount":null,"ratePercent":30}
]`;

function taxBandsDefault(policy?: GratuityPolicyRecord | null): string {
  if (!policy || policy.taxBands.length === 0) {
    return DEFAULT_TAX_BANDS_JSON;
  }

  return JSON.stringify(
    policy.taxBands.map((band) => ({
      upToAmount: band.upToAmount == null ? null : Number(band.upToAmount),
      ratePercent: Number(band.ratePercent),
    })),
    null,
    2,
  );
}

function formulaLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}

export function GratuityPolicyForm({
  policy,
  sourceId,
  canManage,
}: {
  policy?: GratuityPolicyRecord | null;
  sourceId?: string | null;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveGratuityPolicy,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const isCopy = Boolean(sourceId);

  return (
    <form action={formAction}>
      <PageShell>
        <PayrollNav />

        {policy?.id && !sourceId ? (
          <input type="hidden" name="id" value={policy.id} />
        ) : null}
        {sourceId ? (
          <input type="hidden" name="sourceId" value={sourceId} />
        ) : null}

        <PageHeader
          title={
            policy && !sourceId ? "Edit Gratuity Policy" : "New Gratuity Policy"
          }
          description="Organization formula and tax bands for contract-end gratuity settlements."
          backHref="/payroll/settings/gratuity"
          backLabel="Gratuity"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/gratuity">
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save policy"}
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
            {state.fieldErrors ? (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {Object.entries(state.fieldErrors).map(([field, message]) => (
                  <li key={field}>
                    {field}: {message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Gift className="size-4 text-muted-foreground" />
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
                  isCopy
                    ? new Date().toISOString().slice(0, 10)
                    : (policy?.effectiveFrom ?? "")
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
                defaultValue={isCopy ? "" : (policy?.effectiveTo ?? "")}
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
                defaultValue={isCopy ? "" : (policy?.versionLabel ?? "")}
                placeholder="e.g. 2026 MoF"
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sourceReference">
                Source reference
              </label>
              <Input
                id="sourceReference"
                name="sourceReference"
                defaultValue={isCopy ? "" : (policy?.sourceReference ?? "")}
                placeholder="IRD / MoF circular"
                disabled={!canManage}
              />
            </div>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={policy?.isActive ?? true}
                disabled={!canManage}
              />
              Active
            </label>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <SectionHeading>Formula</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="formulaKind">
                Formula kind
              </label>
              <select
                id="formulaKind"
                name="formulaKind"
                defaultValue={policy?.formulaKind ?? "PCT_OF_TERM_EARNINGS"}
                disabled={!canManage}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                required
              >
                <option value="PCT_OF_TERM_EARNINGS">
                  % of term earnings
                </option>
                <option value="PCT_OF_FINAL_MONTHLY_YEARS">
                  % of final monthly × years
                </option>
                <option value="DAYS_PER_YEAR">Days per year of service</option>
                <option value="FLAT_AMOUNT">Flat amount</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="defaultRatePercent"
              >
                Default rate (%)
              </label>
              <Input
                id="defaultRatePercent"
                name="defaultRatePercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={policy?.defaultRatePercent ?? "20"}
                required
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payTiming">
                Pay timing
              </label>
              <select
                id="payTiming"
                name="payTiming"
                defaultValue={policy?.payTiming ?? "LAST_CONTRACT_PAY"}
                disabled={!canManage}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                required
              >
                <option value="LAST_CONTRACT_PAY">Last contract pay</option>
                <option value="OFF_CYCLE_AFTER_END">
                  Off-cycle after end
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="minServiceMonths"
              >
                Min service months (optional)
              </label>
              <Input
                id="minServiceMonths"
                name="minServiceMonths"
                type="number"
                min={0}
                step={1}
                defaultValue={policy?.minServiceMonths ?? ""}
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="daysPerYearOfService"
              >
                Days per year of service
              </label>
              <Input
                id="daysPerYearOfService"
                name="daysPerYearOfService"
                type="number"
                min={0}
                step={0.01}
                defaultValue={policy?.daysPerYearOfService ?? ""}
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="daysInYearBasis">
                Days in year basis
              </label>
              <Input
                id="daysInYearBasis"
                name="daysInYearBasis"
                type="number"
                min={0}
                step={1}
                defaultValue={policy?.daysInYearBasis ?? ""}
                disabled={!canManage}
              />
            </div>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                name="eligibilityOnFullTermOnly"
                defaultChecked={policy?.eligibilityOnFullTermOnly ?? false}
                disabled={!canManage}
              />
              Full term only
            </label>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                name="prorateOnEarlyExit"
                defaultChecked={policy?.prorateOnEarlyExit ?? true}
                disabled={!canManage}
              />
              Prorate on early exit
            </label>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <SectionHeading>Tax</SectionHeading>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="taxMode">
                Tax mode
              </label>
              <select
                id="taxMode"
                name="taxMode"
                defaultValue={policy?.taxMode ?? "TIERED"}
                disabled={!canManage}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                required
              >
                <option value="NONE">None</option>
                <option value="FLAT">Flat</option>
                <option value="TIERED">Tiered</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="flatTaxRatePercent"
              >
                Flat tax rate (%)
              </label>
              <Input
                id="flatTaxRatePercent"
                name="flatTaxRatePercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={policy?.flatTaxRatePercent ?? ""}
                disabled={!canManage}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="taxBandsJson">
                Tax bands (JSON)
              </label>
              <Textarea
                id="taxBandsJson"
                name="taxBandsJson"
                rows={6}
                defaultValue={taxBandsDefault(policy)}
                disabled={!canManage}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Tiered mode: array of {"{ upToAmount, ratePercent }"}. Use{" "}
                <code>null</code> upToAmount for the open remainder band.
              </p>
            </div>
          </div>
        </section>
      </PageShell>
    </form>
  );
}

export function GratuityPolicyDirectory({
  policies,
  canManage,
}: {
  policies: GratuityPolicyRecord[];
  canManage: boolean;
}) {
  const current = policies.find((policy) => policy.isCurrent) ?? null;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Gratuity"
        description="Contract-end gratuity formula and tax configuration for settlement estimates and payment."
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
                      href={`/payroll/settings/gratuity/new?copyFrom=${current.id}`}
                    />
                  }
                >
                  <Copy />
                  New version
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                render={<Link href="/payroll/settings/gratuity/new" />}
              >
                <Plus />
                New policy
              </Button>
            </div>
          ) : undefined
        }
      />

      {policies.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No gratuity policies yet. TT defaults apply until you save one.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_10rem_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {policy.versionLabel ?? policy.effectiveFrom}
                  </p>
                  {policy.isCurrent ? (
                    <Badge variant="success">In effect</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formulaLabel(policy.formulaKind)} ·{" "}
                  {Number(policy.defaultRatePercent)}% · Tax{" "}
                  {policy.taxMode}
                  {policy.taxMode === "FLAT" && policy.flatTaxRatePercent
                    ? ` ${Number(policy.flatTaxRatePercent)}%`
                    : null}
                  {policy.taxMode === "TIERED"
                    ? ` · ${policy.taxBands.length} band${policy.taxBands.length === 1 ? "" : "s"}`
                    : null}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Effective from</p>
                <p className="mt-1 text-sm font-medium">{policy.effectiveFrom}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Effective to</p>
                <p className="mt-1 text-sm font-medium">
                  {policy.effectiveTo ?? "Open-ended"}
                </p>
              </div>

              {canManage ? (
                <div className="flex items-center justify-end">
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={
                      <Link href={`/payroll/settings/gratuity/${policy.id}`} />
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
