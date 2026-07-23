import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { prisma } from "@/lib/prisma";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import {
  defaultTtGratuityPolicyInput,
  getGratuityPolicyAsOf,
  toGratuityPolicyInput,
} from "@/src/modules/payroll/data/get-gratuity-policy";
import { computeSettlementAmounts } from "@/src/modules/payroll/services/gratuity-settlement";

export const metadata: Metadata = {
  title: "My Gratuity",
};

export const dynamic = "force-dynamic";

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

export default async function MyGratuityPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const employeeId = capabilities.employeeId;
  const asOf = new Date();

  const contracts = await prisma.employmentContract.findMany({
    where: {
      employeeId,
      gratuityEligible: true,
    },
    orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
    select: {
      id: true,
      jobTitle: true,
      startDate: true,
      endDate: true,
      baseSalary: true,
      currency: true,
      gratuityRate: true,
      status: true,
      allowances: {
        select: {
          amount: true,
          frequency: true,
          includedInGratuity: true,
        },
      },
      gratuitySettlement: {
        select: {
          status: true,
          grossAmount: true,
          taxAmount: true,
          netAmount: true,
          paidAt: true,
          ratePercent: true,
          contractMonths: true,
        },
      },
    },
  });

  const rows = await Promise.all(
    contracts.map(async (contract) => {
      const settlement = contract.gratuitySettlement;
      if (settlement && settlement.status !== "VOID") {
        return {
          contractId: contract.id,
          jobTitle: contract.jobTitle,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
          currency: contract.currency,
          status: settlement.status,
          gross: settlement.grossAmount.toString(),
          tax: settlement.taxAmount.toString(),
          net: settlement.netAmount.toString(),
          rate: settlement.ratePercent.toString(),
          months: settlement.contractMonths,
          paidAt: settlement.paidAt?.toISOString() ?? null,
          isEstimate: false,
        };
      }

      const policy = await getGratuityPolicyAsOf(contract.endDate ?? asOf);
      const amounts = computeSettlementAmounts(
        {
          startDate: contract.startDate,
          endDate: contract.endDate,
          baseSalary: contract.baseSalary.toString(),
          allowances: contract.allowances.map((row) => ({
            amount: row.amount.toString(),
            frequency: row.frequency,
            includedInGratuity: row.includedInGratuity,
          })),
          gratuityEligible: true,
          gratuityRate: contract.gratuityRate?.toString() ?? null,
        },
        policy ? toGratuityPolicyInput(policy) : defaultTtGratuityPolicyInput(),
        { asOf },
      );

      return {
        contractId: contract.id,
        jobTitle: contract.jobTitle,
        startDate: contract.startDate.toISOString().slice(0, 10),
        endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
        currency: contract.currency,
        status: amounts.ineligibleReason ? "INELIGIBLE" : "PENDING_ESTIMATE",
        gross: amounts.estimatedGrossGratuity.toFixed(2),
        tax: amounts.estimatedTax.toFixed(2),
        net: amounts.estimatedNetGratuity.toFixed(2),
        rate: String(amounts.ratePercent),
        months: amounts.contractMonths,
        paidAt: null,
        isEstimate: true,
      };
    }),
  );

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My gratuity"
        description="Estimated or paid contract gratuity on your eligible employment contracts."
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no gratuity-eligible contracts on file.
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Gross</th>
                <th className="px-3 py-2 font-medium">Tax</th>
                <th className="px-3 py-2 font-medium">Net</th>
                <th className="px-3 py-2 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.contractId} className="border-b border-border/70">
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium">{row.jobTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDisplayDate(row.startDate)}
                      {row.endDate
                        ? ` → ${formatDisplayDate(row.endDate)}`
                        : ""}
                      {` · ${row.months} mo · ${Number(row.rate)}%`}
                    </p>
                    <Link
                      href={`/people/employees/${employeeId}/contracts/${row.contractId}`}
                      className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      View contract
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                    {row.isEstimate ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Estimate only
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {formatMoney(row.gross, { currency: row.currency })}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {formatMoney(row.tax, { currency: row.currency })}
                  </td>
                  <td className="px-3 py-3 align-top font-medium">
                    {formatMoney(row.net, { currency: row.currency })}
                  </td>
                  <td className="px-3 py-3 align-top text-muted-foreground">
                    {row.paidAt
                      ? formatDisplayDate(row.paidAt.slice(0, 10))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
