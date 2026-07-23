"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import {
  approveGratuitySettlement,
  recalculateGratuitySettlement,
  type GratuitySettlementFormState,
} from "@/src/modules/payroll/actions/manage-gratuity-settlement";
import type { GratuitySettlementDetail } from "@/src/modules/payroll/data/get-gratuity-settlements";

const idle: GratuitySettlementFormState = {
  status: "idle",
  message: "",
};

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "success";
    case "APPROVED":
    case "SCHEDULED":
      return "default";
    case "CALCULATED":
      return "secondary";
    case "ESTIMATED":
    case "PENDING_ESTIMATE":
      return "warning";
    case "INELIGIBLE":
    case "VOID":
      return "destructive";
    default:
      return "outline";
  }
}

function ActionForm({
  action,
  children,
  hidden,
}: {
  action: (
    prev: GratuitySettlementFormState,
    formData: FormData,
  ) => Promise<GratuitySettlementFormState>;
  children: React.ReactNode;
  hidden: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, idle);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    } else if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="inline-flex">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

function Detail({
  labelText,
  value,
}: {
  labelText: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{labelText}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export function ContractGratuityPanel({
  settlement,
  canManage,
  employeeId,
  contractId,
  fallback,
}: {
  settlement: GratuitySettlementDetail | null;
  canManage: boolean;
  employeeId: string;
  contractId: string;
  fallback?: {
    eligible: boolean;
    rate: string | null;
    taxRate: string | null;
    contractMonths: number | string | null;
    estimatedGrossEarnings: string | null;
    estimatedGrossGratuity: string | null;
    estimatedTax: string | null;
    estimatedNetGratuity: string | null;
    annualEligibleEarnings: string;
    currency: string;
  };
}) {
  if (!settlement && !fallback?.eligible) {
    return (
      <p className="text-sm text-muted-foreground">
        This contract is not marked gratuity-eligible.
      </p>
    );
  }

  if (!settlement && fallback) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Detail labelText="Eligible" value="Yes" />
        <Detail
          labelText="Gratuity rate"
          value={fallback.rate ? `${fallback.rate}%` : "Not applicable"}
        />
        <Detail
          labelText="Tax rate"
          value="Org policy (IRD tiers)"
        />
        <Detail
          labelText="Contract months"
          value={
            fallback.contractMonths != null
              ? String(fallback.contractMonths)
              : "Needs end date"
          }
        />
        <Detail
          labelText="Eligible earnings (period)"
          value={
            fallback.estimatedGrossEarnings
              ? formatMoney(fallback.estimatedGrossEarnings, {
                  currency: fallback.currency,
                })
              : "Not applicable"
          }
        />
        <Detail
          labelText="Estimated gross gratuity"
          value={
            fallback.estimatedGrossGratuity
              ? formatMoney(fallback.estimatedGrossGratuity, {
                  currency: fallback.currency,
                })
              : "Not applicable"
          }
        />
        <Detail
          labelText="Estimated tax"
          value={
            fallback.estimatedTax
              ? formatMoney(fallback.estimatedTax, {
                  currency: fallback.currency,
                })
              : "Not applicable"
          }
        />
        <Detail
          labelText="Estimated net gratuity"
          value={
            fallback.estimatedNetGratuity
              ? formatMoney(fallback.estimatedNetGratuity, {
                  currency: fallback.currency,
                })
              : "Not applicable"
          }
        />
        <Detail
          labelText="Annual eligible earnings base"
          value={formatMoney(fallback.annualEligibleEarnings, {
            currency: fallback.currency,
          })}
        />
        {canManage ? (
          <div className="md:col-span-3">
            <ActionForm
              action={recalculateGratuitySettlement}
              hidden={{ contractId }}
            >
              <Button type="submit" size="sm" variant="outline">
                Create settlement
              </Button>
            </ActionForm>
          </div>
        ) : null}
      </div>
    );
  }

  if (!settlement) {
    return null;
  }

  const isPaid = settlement.status === "PAID";
  const amountLabel = isPaid ? "Paid" : "Estimated";
  const canApprove =
    canManage &&
    settlement.settlementId != null &&
    (settlement.status === "CALCULATED" || settlement.status === "ESTIMATED");
  const canRecalculate =
    canManage &&
    settlement.status !== "PAID" &&
    settlement.status !== "SCHEDULED" &&
    settlement.status !== "APPROVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusBadgeVariant(settlement.status)}>
          {settlement.status.replaceAll("_", " ")}
        </Badge>
        {settlement.isSynthesized ? (
          <span className="text-xs text-muted-foreground">
            Live estimate — not yet saved as a settlement
          </span>
        ) : null}
        <Link
          href={`/payroll/gratuity?year=${
            settlement.contractEndDate?.slice(0, 4) ??
            new Date().getUTCFullYear()
          }`}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Open gratuity queue
        </Link>
        <Link
          href={`/payroll/employees/${employeeId}`}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Employee payroll
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Detail
          labelText={`${amountLabel} gross`}
          value={formatMoney(settlement.grossAmount, {
            currency: settlement.currency,
          })}
        />
        <Detail
          labelText={`${amountLabel} tax`}
          value={formatMoney(settlement.taxAmount, {
            currency: settlement.currency,
          })}
        />
        <Detail
          labelText={`${amountLabel} net`}
          value={formatMoney(settlement.netAmount, {
            currency: settlement.currency,
          })}
        />
        <Detail
          labelText="Policy rate"
          value={`${Number(settlement.ratePercent)}%`}
        />
        <Detail
          labelText="Contract months"
          value={String(settlement.contractMonths)}
        />
        <Detail
          labelText="Service years"
          value={
            settlement.serviceYears
              ? Number(settlement.serviceYears).toFixed(2)
              : "—"
          }
        />
        <Detail
          labelText="Earnings basis"
          value={
            settlement.earningsBasis === "ACTUAL_PAYROLL"
              ? `Actual payroll (${settlement.actualPayslipCount ?? 0} slips)`
              : "Contract schedule"
          }
        />
        {settlement.earningsBasis === "ACTUAL_PAYROLL" &&
        settlement.varianceGrossGratuity != null ? (
          <>
            <Detail
              labelText="Contract estimate (gross)"
              value={
                settlement.contractEstimateGrossGratuity
                  ? formatMoney(settlement.contractEstimateGrossGratuity, {
                      currency: settlement.currency,
                    })
                  : "—"
              }
            />
            <Detail
              labelText="Variance vs estimate"
              value={formatMoney(settlement.varianceGrossGratuity, {
                currency: settlement.currency,
              })}
            />
          </>
        ) : null}
        {settlement.paidAt ? (
          <Detail
            labelText="Paid at"
            value={formatDisplayDate(settlement.paidAt.slice(0, 10))}
          />
        ) : null}
        {settlement.payRunId ? (
          <div>
            <p className="text-xs text-muted-foreground">Pay run</p>
            <p className="mt-1 text-sm font-medium">
              <Link
                href={`/payroll/runs/${settlement.payRunId}`}
                className="underline-offset-2 hover:underline"
              >
                View pay run
              </Link>
            </p>
          </div>
        ) : null}
        <Detail
          labelText="Tax remittance"
          value={(settlement.taxRemittanceStatus ?? "N/A").replaceAll(
            "_",
            " ",
          )}
        />
        {settlement.taxRemittanceReference ? (
          <Detail
            labelText="Remittance reference"
            value={settlement.taxRemittanceReference}
          />
        ) : null}
        {settlement.policy?.versionLabel || settlement.policy?.effectiveFrom ? (
          <Detail
            labelText="Policy"
            value={
              settlement.policy.versionLabel ??
              settlement.policy.effectiveFrom ??
              "—"
            }
          />
        ) : null}
      </div>

      {canManage && (canRecalculate || canApprove) ? (
        <div className="flex flex-wrap gap-2">
          {canRecalculate ? (
            <ActionForm
              action={recalculateGratuitySettlement}
              hidden={{ contractId }}
            >
              <Button type="submit" size="sm" variant="outline">
                {settlement.settlementId ? "Recalculate" : "Save settlement"}
              </Button>
            </ActionForm>
          ) : null}
          {canApprove ? (
            <ActionForm
              action={approveGratuitySettlement}
              hidden={{ settlementId: settlement.settlementId! }}
            >
              <Button type="submit" size="sm">
                Approve
              </Button>
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
