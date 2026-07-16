import Link from "next/link"
import type { Metadata } from "next"
import {
  AlertTriangle,
  CalendarClock,
  FileSignature,
  WalletCards,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/src/components/layout/page-header"
import { formatMoney } from "@/src/lib/format"
import { getContractMonitoringDashboard } from "@/src/modules/hr/data/get-employment-contracts"

export const metadata: Metadata = {
  title: "Contract Monitoring",
}

export const dynamic = "force-dynamic"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function expiryLabel(
  category:
    | "EXPIRED"
    | "WITHIN_30_DAYS"
    | "WITHIN_60_DAYS"
    | "WITHIN_90_DAYS"
    | "LATER"
    | "NO_END_DATE",
): string {
  switch (category) {
    case "EXPIRED":
      return "Expired"
    case "WITHIN_30_DAYS":
      return "Within 30 days"
    case "WITHIN_60_DAYS":
      return "Within 60 days"
    case "WITHIN_90_DAYS":
      return "Within 90 days"
    case "NO_END_DATE":
      return "No end date"
    default:
      return "Later"
  }
}

export default async function ContractsPage() {
  const dashboard =
    await getContractMonitoringDashboard()

  const monitoredContracts = dashboard.contracts.filter(
    (contract) =>
      contract.isCurrent ||
      contract.expiryCategory === "EXPIRED",
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Contract Monitoring"
        description="Monitor current employment contracts, upcoming expirations and estimated gratuity exposure."
      />

      <section className="grid gap-6 border-y border-border py-6 sm:grid-cols-2 xl:grid-cols-6">
        <div>
          <p className="text-xs text-muted-foreground">
            Active
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.active}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Within 30 days
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.expiringWithin30Days}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Within 60 days
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.expiringWithin60Days}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Within 90 days
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.expiringWithin90Days}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Expired
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.expired}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            No end date
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {dashboard.summary.missingEndDate}
          </p>
        </div>
      </section>

      <section className="grid gap-6 border-y border-border py-6 md:grid-cols-3">
        <div className="flex gap-3">
          <CalendarClock className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Expiry monitoring
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contracts are grouped into 30, 60 and 90-day
              expiry windows.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Action required
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Expired current contracts should be closed,
              renewed or amended.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <WalletCards className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Estimated gratuity exposure
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(
                dashboard.summary.estimatedNetGratuityExposure,
                { currency: "TTD" },
              )}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contracts
          </h2>
        </div>

        {monitoredContracts.length === 0 ? (
          <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
            No contracts are available for monitoring.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {monitoredContracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/people/employees/${contract.employeeId}/contracts/${contract.id}`}
                className="grid gap-5 py-5 hover:bg-muted/20 lg:grid-cols-[1.3fr_1fr_10rem_10rem_11rem]"
              >
                <div>
                  <p className="font-medium">
                    {contract.employeeName}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {contract.employeeNumber}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {contract.jobTitle}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Contract
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.contractNumber ??
                      "No contract number"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {label(contract.contractType)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    End date
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.endDate ?? "None"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Expiry
                  </p>
                  <div className="mt-1">
                    <Badge
                      variant={
                        contract.expiryCategory ===
                          "EXPIRED" ||
                        contract.expiryCategory ===
                          "WITHIN_30_DAYS"
                          ? "destructive"
                          : contract.expiryCategory ===
                                "WITHIN_60_DAYS" ||
                              contract.expiryCategory ===
                                "WITHIN_90_DAYS"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {expiryLabel(
                        contract.expiryCategory,
                      )}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Net gratuity estimate
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.estimatedNetGratuity
                      ? formatMoney(
                          contract.estimatedNetGratuity,
                          { currency: contract.currency },
                        )
                      : "Not applicable"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
