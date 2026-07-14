import { ModuleStatusIndicator } from "@/src/components/ui/module-status"
import { PageAlert } from "@/src/components/ui/page-alert"
import { PageHeader } from "@/src/components/layout/page-header"
import { appConfig } from "@/src/config/app.config"
import {
  dashboardMetrics,
  moduleStatuses,
  recentActivity,
  upcomingEvents,
} from "@/src/core/dashboard/placeholder-data"

export function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description={`Overview of ${appConfig.displayName} for ${appConfig.organizationName}. Module workspaces will surface operational detail here as they come online.`}
      />

      <PageAlert severity="information" title="Platform shell ready">
        HR and Payroll modules are scaffolded but not yet implemented. Shared
        notifications, alerts, and theme controls are available across the
        application shell.
      </PageAlert>

      <section aria-labelledby="summary-metrics-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            id="summary-metrics-heading"
            className="text-sm font-semibold tracking-wide text-foreground uppercase"
          >
            Summary
          </h2>
          <p className="text-xs text-muted-foreground">Placeholder metrics</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 md:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {metric.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {metric.hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section aria-labelledby="upcoming-heading" className="min-w-0">
          <h2
            id="upcoming-heading"
            className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase"
          >
            Upcoming
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {upcomingEvents.map((event) => (
              <li
                key={event.title}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.module}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {event.when}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="activity-heading" className="min-w-0">
          <h2
            id="activity-heading"
            className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase"
          >
            Recent activity
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {recentActivity.map((item) => (
              <li key={item.title} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.when}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="status-heading">
        <h2
          id="status-heading"
          className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase"
        >
          System status
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {moduleStatuses.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                {item.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                )}
              </div>
              <ModuleStatusIndicator status={item.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
