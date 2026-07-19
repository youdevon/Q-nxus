import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  FileSignature,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { formatMoney, formatDisplayDate } from "@/src/lib/format";
import { cn } from "@/lib/utils";
import { getContractMonitoringDashboard } from "@/src/modules/hr/data/get-employment-contracts";
import { requireContractViewAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Contract Monitoring",
};

export const dynamic = "force-dynamic";

type ExpiringFilter = "30" | "60" | "90" | "expired" | "none";
type StatusFilter = "pending" | "signature" | "draft";

type SearchParams = Promise<{
  expiring?: string;
  within?: string;
  status?: string;
}>;

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
      return "Expired";
    case "WITHIN_30_DAYS":
      return "Within 30 days";
    case "WITHIN_60_DAYS":
      return "Within 60 days";
    case "WITHIN_90_DAYS":
      return "Within 90 days";
    case "NO_END_DATE":
      return "No end date";
    default:
      return "Later";
  }
}

function parseExpiringFilter(value: string | undefined): ExpiringFilter | null {
  if (
    value === "30" ||
    value === "60" ||
    value === "90" ||
    value === "expired" ||
    value === "none"
  ) {
    return value;
  }

  return null;
}

function parseWithinDays(value: string | undefined): 90 | null {
  return value === "90" ? 90 : null;
}

function matchesExpiringFilter(
  category:
    | "EXPIRED"
    | "WITHIN_30_DAYS"
    | "WITHIN_60_DAYS"
    | "WITHIN_90_DAYS"
    | "LATER"
    | "NO_END_DATE",
  filter: ExpiringFilter,
): boolean {
  switch (filter) {
    case "30":
      return category === "WITHIN_30_DAYS";
    case "60":
      return category === "WITHIN_60_DAYS";
    case "90":
      return category === "WITHIN_90_DAYS";
    case "expired":
      return category === "EXPIRED";
    case "none":
      return category === "NO_END_DATE";
  }
}

function matchesWithinDays(
  category:
    | "EXPIRED"
    | "WITHIN_30_DAYS"
    | "WITHIN_60_DAYS"
    | "WITHIN_90_DAYS"
    | "LATER"
    | "NO_END_DATE",
  withinDays: 90,
): boolean {
  if (withinDays !== 90) {
    return false;
  }

  return (
    category === "EXPIRED" ||
    category === "WITHIN_30_DAYS" ||
    category === "WITHIN_60_DAYS" ||
    category === "WITHIN_90_DAYS"
  );
}

function StatFilterLink({
  href,
  label: statLabel,
  value,
  active,
}: {
  href: string;
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block min-w-0 rounded-lg border px-3 py-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-border bg-muted/50 shadow-sm"
          : "border-border/60 hover:border-border hover:bg-muted/30",
      )}
    >
      <p className="text-xs leading-snug text-muted-foreground">{statLabel}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireContractViewAccess();

  const params = await searchParams;
  const expiringFilter = parseExpiringFilter(params.expiring);
  const withinDays = expiringFilter ? null : parseWithinDays(params.within);
  const statusFilter: StatusFilter | null =
    params.status === "pending" ||
    params.status === "signature" ||
    params.status === "draft"
      ? params.status
      : null;
  const hasListFilter = Boolean(expiringFilter || withinDays || statusFilter);

  const dashboard = await getContractMonitoringDashboard();

  const monitoredContracts = dashboard.contracts.filter(
    (contract) => contract.isCurrent || contract.expiryCategory === "EXPIRED",
  );

  const statusQueueContracts = statusFilter
    ? dashboard.contracts.filter((contract) => {
        if (statusFilter === "pending") {
          return contract.status === "PENDING_APPROVAL";
        }
        if (statusFilter === "signature") {
          return contract.status === "AWAITING_SIGNATURE";
        }
        return contract.status === "DRAFT";
      })
    : null;

  const filteredContracts = statusQueueContracts
    ? statusQueueContracts
    : expiringFilter
      ? monitoredContracts.filter((contract) =>
          matchesExpiringFilter(contract.expiryCategory, expiringFilter),
        )
      : withinDays
        ? monitoredContracts.filter((contract) =>
            matchesWithinDays(contract.expiryCategory, withinDays),
          )
        : monitoredContracts;

  const filterMessage = statusFilter
    ? `Showing contracts in the “${
        statusFilter === "pending"
          ? "Pending approval"
          : statusFilter === "signature"
            ? "Awaiting signature"
            : "Draft"
      }” queue.`
    : expiringFilter
      ? `Showing contracts in the “${
          expiringFilter === "none"
            ? "No end date"
            : expiringFilter === "expired"
              ? "Expired"
              : `Within ${expiringFilter} days`
        }” window.`
      : withinDays
        ? "Showing current and expired contracts ending within 90 days."
        : null;

  return (
    <PageShell size="xl">
      <PeoplePageHeader
        title="Contract Monitoring"
        description="Monitor current employment contracts, upcoming expirations and estimated gratuity exposure."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatFilterLink
          href="/contracts?status=draft"
          label="Draft"
          value={dashboard.summary.draft}
          active={statusFilter === "draft"}
        />
        <StatFilterLink
          href="/contracts?status=pending"
          label="Pending approval"
          value={dashboard.summary.pendingApproval}
          active={statusFilter === "pending"}
        />
        <StatFilterLink
          href="/contracts?status=signature"
          label="Awaiting signature"
          value={dashboard.summary.awaitingSignature}
          active={statusFilter === "signature"}
        />
        <StatFilterLink
          href="/contracts"
          label="Active current"
          value={dashboard.summary.active}
          active={!hasListFilter}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatFilterLink
          href="/contracts"
          label="Active"
          value={dashboard.summary.active}
          active={!hasListFilter}
        />

        <StatFilterLink
          href={expiringFilter === "30" ? "/contracts" : "/contracts?expiring=30"}
          label="Within 30 days"
          value={dashboard.summary.expiringWithin30Days}
          active={expiringFilter === "30"}
        />

        <StatFilterLink
          href={expiringFilter === "60" ? "/contracts" : "/contracts?expiring=60"}
          label="Within 60 days"
          value={dashboard.summary.expiringWithin60Days}
          active={expiringFilter === "60"}
        />

        <StatFilterLink
          href={expiringFilter === "90" ? "/contracts" : "/contracts?expiring=90"}
          label="Within 90 days"
          value={dashboard.summary.expiringWithin90Days}
          active={expiringFilter === "90"}
        />

        <StatFilterLink
          href={
            expiringFilter === "expired"
              ? "/contracts"
              : "/contracts?expiring=expired"
          }
          label="Expired"
          value={dashboard.summary.expired}
          active={expiringFilter === "expired"}
        />

        <StatFilterLink
          href={
            expiringFilter === "none" ? "/contracts" : "/contracts?expiring=none"
          }
          label="No end date"
          value={dashboard.summary.missingEndDate}
          active={expiringFilter === "none"}
        />
      </section>

      {filterMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm">
          <p className="text-muted-foreground">{filterMessage}</p>
          <Link
            href="/contracts"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-3">
        <div className="flex gap-3">
          <CalendarClock className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Expiry monitoring</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contracts are grouped into 30, 60 and 90-day expiry windows.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Action required</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Expired current contracts should be closed, renewed or amended.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <WalletCards className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Estimated gratuity exposure</p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(dashboard.summary.estimatedNetGratuityExposure, {
                currency: "TTD",
              })}
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

        {filteredContracts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {hasListFilter
              ? "No contracts match this filter."
              : "No contracts are available for monitoring."}
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredContracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/people/employees/${contract.employeeId}/contracts/${contract.id}`}
                className="grid gap-5 py-5 hover:bg-muted/20 lg:grid-cols-[1.3fr_1fr_10rem_10rem_11rem]"
              >
                <div>
                  <p className="font-medium">{contract.employeeName}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {contract.employeeNumber}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {contract.positionTitle}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Contract</p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.contractNumber ?? "No contract number"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {label(contract.contractType)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">End date</p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.endDate
                      ? formatDisplayDate(contract.endDate)
                      : "None"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Expiry</p>
                  <div className="mt-1">
                    <Badge
                      variant={
                        contract.expiryCategory === "EXPIRED" ||
                        contract.expiryCategory === "WITHIN_30_DAYS"
                          ? "destructive"
                          : contract.expiryCategory === "WITHIN_60_DAYS" ||
                              contract.expiryCategory === "WITHIN_90_DAYS"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {expiryLabel(contract.expiryCategory)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Net gratuity estimate
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.estimatedNetGratuity
                      ? formatMoney(contract.estimatedNetGratuity, {
                          currency: contract.currency,
                        })
                      : "Not applicable"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
