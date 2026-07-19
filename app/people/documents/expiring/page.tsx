import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { getExpiringEmployeeFileItems } from "@/src/modules/hr/data/get-expiring-employee-file-items";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import {
  EXPIRY_DASHBOARD_WINDOWS,
  isExpiryDashboardWindow,
} from "@/src/modules/hr/lib/correspondence-visibility";
import { formatDisplayDate } from "@/src/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Expiring documents",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  days?: string;
}>;

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

export default async function ExpiringDocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requirePeopleManageAccess();
  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { organizationId: true },
  });

  if (!user) {
    return null;
  }

  const parsedDays = Number.parseInt(params.days ?? "30", 10);
  const windowDays = isExpiryDashboardWindow(parsedDays) ? parsedDays : 30;

  const dashboard = await getExpiringEmployeeFileItems({
    organizationId: user.organizationId,
    windowDays,
  });

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Expiring documents"
        description="Credentials and training records approaching expiry"
        backHref="/people/documents"
        backLabel="Documents"
      />

      <section className="flex flex-wrap gap-2 text-sm">
        {EXPIRY_DASHBOARD_WINDOWS.map((days) => (
          <Link
            key={days}
            href={`/people/documents/expiring?days=${days}`}
            className={[
              "rounded-md border px-3 py-1.5 hover:bg-muted/40",
              windowDays === days ? "bg-muted font-medium" : "",
            ].join(" ")}
          >
            Within {days} days
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SectionHeading>Already expired</SectionHeading>
          <Badge variant="destructive">{dashboard.expired.length}</Badge>
        </div>
        {dashboard.expired.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expired credentials or training records.
          </p>
        ) : (
          <ExpiryList items={dashboard.expired} />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SectionHeading>Expiring within {windowDays} days</SectionHeading>
          <Badge variant="warning">{dashboard.expiring.length}</Badge>
        </div>
        {dashboard.expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing expiring in this window.
          </p>
        ) : (
          <ExpiryList items={dashboard.expiring} />
        )}
      </section>
    </PageShell>
  );
}

function ExpiryList({
  items,
}: {
  items: Awaited<
    ReturnType<typeof getExpiringEmployeeFileItems>
  >["expiring"];
}) {
  return (
    <div className="divide-y divide-border/70">
      {items.map((item) => (
        <article
          key={`${item.kind}-${item.id}`}
          className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={item.fileHref}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.employeeName}
              </Link>
              <Badge variant="outline">{item.employeeNumber}</Badge>
              <Badge variant="secondary">
                {item.kind === "credential" ? "Credential" : "Training"}
              </Badge>
            </div>
            <p className="text-sm">{item.label}</p>
            {item.issuerOrProvider ? (
              <p className="text-xs text-muted-foreground">
                {item.issuerOrProvider}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-sm sm:text-right">
            <p className="font-medium">{formatDate(item.expiryDate)}</p>
            <p className="text-xs text-muted-foreground">
              {item.daysUntil < 0
                ? `${Math.abs(item.daysUntil)} day${Math.abs(item.daysUntil) === 1 ? "" : "s"} overdue`
                : item.daysUntil === 0
                  ? "Expires today"
                  : `${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"} left`}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
