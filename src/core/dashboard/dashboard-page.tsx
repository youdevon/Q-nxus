import Link from "next/link"
import {
  CalendarClock,
  ClipboardCheck,
  FileSignature,
  Users,
} from "lucide-react"

import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { PageAlert } from "@/src/components/ui/page-alert"
import { appConfig } from "@/src/config/app.config"
import { getOperationalHomeDashboard } from "@/src/core/dashboard/get-operational-home"
import { cn } from "@/lib/utils"

function StatLink({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg border border-transparent px-3 py-3 -mx-3",
        "transition-colors hover:border-border/80 hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 opacity-70" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums group-hover:text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        View details
      </p>
    </Link>
  )
}

function StatStatic({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number
  hint: string
  icon: typeof Users
}) {
  return (
    <div className="px-3 py-3 -mx-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 opacity-70" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export async function DashboardPage() {
  const dashboard = await getOperationalHomeDashboard()

  if (!dashboard) {
    return (
      <PageShell size="lg">
        <PageHeader
          title="Dashboard"
          description={`Sign in to see operational work for ${appConfig.displayName}.`}
        />
      </PageShell>
    )
  }

  const stats = [
    dashboard.canViewLeave
      ? {
          key: "on-leave",
          href: "/leave?view=on-leave",
          label: "People currently on leave",
          value: dashboard.currentlyOnLeaveCount,
          icon: Users,
        }
      : null,
    dashboard.canApproveLeave
      ? {
          key: "pending-leave",
          href: "/leave#approvals",
          label: "Pending leave approvals",
          value: dashboard.pendingLeaveCount,
          icon: ClipboardCheck,
        }
      : null,
    dashboard.canViewContracts
      ? {
          key: "contracts",
          href: "/contracts?within=90",
          label: "Contracts within 90 days",
          value: dashboard.contractsExpiringCount,
          icon: FileSignature,
        }
      : null,
  ].filter(Boolean) as {
    key: string
    href: string
    label: string
    value: number
    icon: typeof Users
  }[]

  const statColumns =
    stats.length <= 1 ? "sm:grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"

  return (
    <PageShell size="lg">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${dashboard.userName}. Operational items that need attention across ${appConfig.displayName}.`}
      />

      {dashboard.vacationForfeitureWarning ? (
        <PageAlert
          severity={
            dashboard.vacationForfeitureWarning.isUrgent
              ? "critical"
              : "warning"
          }
          title="Mandatory vacation cannot roll over"
        >
          <p>{dashboard.vacationForfeitureWarning.message}</p>
          <p className="mt-2">
            <Link
              href="/leave/new"
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Request vacation leave
            </Link>{" "}
            so it finishes on or before{" "}
            {dashboard.vacationForfeitureWarning.contractEndDateIso}.
          </p>
        </PageAlert>
      ) : null}

      {stats.length > 0 ? (
        <section className={cn("grid gap-2", statColumns)}>
          {stats.map((stat) => (
            <StatLink
              key={stat.key}
              href={stat.href}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
            />
          ))}
        </section>
      ) : (
        <section className="grid gap-2 sm:grid-cols-1">
          <StatStatic
            label="Operational queue"
            value={0}
            hint="No leave or contract monitoring permissions on this account."
            icon={ClipboardCheck}
          />
        </section>
      )}

      <div
        className={cn(
          "grid gap-8",
          dashboard.canApproveLeave && dashboard.canViewContracts
            ? "lg:grid-cols-2"
            : "lg:grid-cols-1",
        )}
      >
        {dashboard.canApproveLeave ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                <ClipboardCheck className="size-4 text-muted-foreground" />
                Leave awaiting my decision
              </h2>
              <Link
                href="/leave#approvals"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open leave
              </Link>
            </div>

            {dashboard.pendingLeaveForMe.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leave requests are waiting for your decision.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {dashboard.pendingLeaveForMe.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/leave/${request.id}`}
                      className="block py-3 hover:bg-muted/20"
                    >
                      <p className="text-sm font-medium">
                        {request.employeeName} · {request.leaveTypeName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.startDate} to {request.endDate}
                        {request.requestNumber
                          ? ` · ${request.requestNumber}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {dashboard.canViewContracts ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                <FileSignature className="size-4 text-muted-foreground" />
                Contracts expiring
              </h2>
              <Link
                href="/contracts?within=90"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Contract monitoring
              </Link>
            </div>

            {dashboard.contractsExpiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No current contracts expire within 90 days.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {dashboard.contractsExpiring.map((contract) => (
                  <li key={contract.id}>
                    <Link
                      href={`/people/employees/${contract.employeeId}/contracts/${contract.id}`}
                      className="flex items-start justify-between gap-3 py-3 hover:bg-muted/20"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {contract.employeeName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {contract.jobTitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {contract.daysUntilExpiry < 0
                          ? "Expired"
                          : `${contract.daysUntilExpiry}d · ${contract.endDate}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      {dashboard.canViewContracts ? (
        <section className="flex gap-3 text-xs text-muted-foreground">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <p>
            Contract expiry reminders are generated for HR and contract managers
            when current contracts enter the 30 / 60 / 90-day windows
            (deduplicated for 14 days).
          </p>
        </section>
      ) : null}
    </PageShell>
  )
}
