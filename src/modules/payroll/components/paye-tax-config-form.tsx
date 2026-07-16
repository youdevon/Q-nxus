"use client";

import { useActionState, useEffect, useState } from "react";
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
  savePayeTaxConfig,
  type PayeTaxFormState,
} from "@/src/modules/payroll/actions/manage-paye-tax-config";
import type { PayeTaxConfigRecord } from "@/src/modules/payroll/lib/paye-contribution";
import { PayrollNav } from "./payroll-nav";

const initialState: PayeTaxFormState = {
  status: "idle",
  message: "",
};

type BracketRow = {
  upToAmount: string;
  ratePercent: string;
};

export function PayeTaxConfigForm({
  config,
  sourceId,
  canManage,
}: {
  config?: PayeTaxConfigRecord | null;
  sourceId?: string | null;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    savePayeTaxConfig,
    initialState,
  );
  const [brackets, setBrackets] = useState<BracketRow[]>(() =>
    config?.brackets.map((bracket) => ({
      upToAmount: bracket.upToAmount ?? "",
      ratePercent: bracket.ratePercent,
    })) ?? [
      { upToAmount: "1000000", ratePercent: "25" },
      { upToAmount: "", ratePercent: "30" },
    ],
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const bracketsJson = JSON.stringify(
    brackets.map((row) => ({
      upToAmount: row.upToAmount.trim() === "" ? null : row.upToAmount.trim(),
      ratePercent: row.ratePercent.trim(),
    })),
  );

  return (
    <form action={formAction}>
      <PageShell>
        <PayrollNav />

        {config?.id && !sourceId ? (
          <input type="hidden" name="id" value={config.id} />
        ) : null}
        {sourceId ? <input type="hidden" name="sourceId" value={sourceId} /> : null}
        <input type="hidden" name="bracketsJson" value={bracketsJson} />

        <PageHeader
          title={
            config && !sourceId
              ? "Edit PAYE Configuration"
              : "New PAYE Configuration"
          }
          description="Annual taxable income, personal allowance, NIS deductible portion, and progressive brackets — not a flat monthly percentage."
          backHref="/payroll/settings/paye"
          backLabel="PAYE"
          actions={
            canManage ? (
              <FormPageActions cancelHref="/payroll/settings/paye">
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save PAYE config"}
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

        <section className="grid gap-5 md:grid-cols-2">
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
            <label
              className="text-sm font-medium"
              htmlFor="personalAllowanceAnnual"
            >
              Personal allowance (annual TTD)
            </label>
            <Input
              id="personalAllowanceAnnual"
              name="personalAllowanceAnnual"
              type="number"
              min={0}
              step={0.01}
              defaultValue={config?.personalAllowanceAnnual ?? "90000"}
              required
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="nisDeductiblePortion"
            >
              NIS deductible portion (0–1)
            </label>
            <Input
              id="nisDeductiblePortion"
              name="nisDeductiblePortion"
              type="number"
              min={0}
              max={1}
              step={0.0001}
              defaultValue={config?.nisDeductiblePortion ?? "0.7"}
              required
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label
              className="text-sm font-medium"
              htmlFor="approvedDeductionCapAnnual"
            >
              Approved deduction cap (annual TTD)
            </label>
            <Input
              id="approvedDeductionCapAnnual"
              name="approvedDeductionCapAnnual"
              type="number"
              min={0}
              step={0.01}
              defaultValue={config?.approvedDeductionCapAnnual ?? "60000"}
              required
              disabled={!canManage}
            />
            <p className="text-xs text-muted-foreground">
              Combined limit for pension/annuity/tax-savings + allowable NIS
              portion.
            </p>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-muted-foreground" />
              <SectionHeading>Tax brackets</SectionHeading>
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setBrackets((rows) => [
                    ...rows,
                    { upToAmount: "", ratePercent: "" },
                  ])
                }
              >
                <Plus />
                Add bracket
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            {brackets.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 md:grid-cols-[1fr_8rem_auto]"
              >
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Chargeable income up to (blank = open-ended)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.upToAmount}
                    onChange={(event) =>
                      setBrackets((rows) =>
                        rows.map((item, rowIndex) =>
                          rowIndex === index
                            ? { ...item, upToAmount: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!canManage}
                    placeholder="Open-ended"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Rate %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.0001}
                    value={row.ratePercent}
                    onChange={(event) =>
                      setBrackets((rows) =>
                        rows.map((item, rowIndex) =>
                          rowIndex === index
                            ? { ...item, ratePercent: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!canManage}
                    required
                  />
                </div>
                {canManage && brackets.length > 1 ? (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setBrackets((rows) =>
                          rows.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </PageShell>
    </form>
  );
}

export function PayeTaxDirectory({
  configs,
  canManage,
}: {
  configs: PayeTaxConfigRecord[];
  canManage: boolean;
}) {
  const current = configs.find((config) => config.isCurrent) ?? null;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="PAYE (Income Tax)"
        description="Estimated from annual taxable income after personal allowance and approved deductions (including 70% of employee NIS)."
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
                      href={`/payroll/settings/paye/new?copyFrom=${current.id}`}
                    />
                  }
                >
                  <Copy />
                  New version
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                render={<Link href="/payroll/settings/paye/new" />}
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
          No PAYE configurations yet.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {configs.map((config) => (
            <div
              key={config.id}
              className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_10rem_10rem_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {config.versionLabel ?? config.effectiveFrom}
                  </p>
                  {config.isCurrent ? (
                    <Badge variant="success">In effect</Badge>
                  ) : null}
                  <Badge variant={config.isActive ? "success" : "outline"}>
                    {config.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Personal allowance{" "}
                  {formatMoney(config.personalAllowanceAnnual, {
                    currency: "TTD",
                  })}
                  /yr · NIS deductible{" "}
                  {(Number(config.nisDeductiblePortion) * 100).toFixed(0)}% · Cap{" "}
                  {formatMoney(config.approvedDeductionCapAnnual, {
                    currency: "TTD",
                  })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Brackets:{" "}
                  {config.brackets
                    .map(
                      (bracket) =>
                        `${Number(bracket.ratePercent)}%${
                          bracket.upToAmount
                            ? ` to ${formatMoney(bracket.upToAmount)}`
                            : " above"
                        }`,
                    )
                    .join(" · ")}
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

              <div />

              {canManage ? (
                <div className="flex items-center justify-end">
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={
                      <Link href={`/payroll/settings/paye/${config.id}/edit`} />
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
