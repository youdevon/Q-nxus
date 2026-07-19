import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ChevronRight, FolderOpen, FileText } from "lucide-react";

import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { ArchiveExpiredRetentionButton } from "@/src/modules/hr/components/archive-expired-retention-button";
import { EmployeeDirectoryRow } from "@/src/modules/hr/components/employee-directory-row";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import {
  countPastRetentionCorrespondence,
  searchOrgCorrespondence,
  type OrgCorrespondenceSearchFilters,
} from "@/src/modules/hr/data/get-correspondence-templates";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import {
  CORRESPONDENCE_CATEGORIES,
  CORRESPONDENCE_STATUSES,
} from "@/src/modules/hr/lib/correspondence-visibility";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { formatDisplayDate } from "@/src/lib/format";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function correspondenceStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACKNOWLEDGED":
      return "success";
    case "ISSUED":
      return "warning";
    case "ARCHIVED":
    case "SUPERSEDED":
      return "secondary";
    default:
      return "outline";
  }
}

export const metadata: Metadata = {
  title: "Documents Search",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  category?: string;
  status?: string;
  subType?: string;
  overdueAck?: string;
  expiringRetention?: string;
  pastRetention?: string;
  issueFrom?: string;
  issueTo?: string;
}>;

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

export default async function PeopleDocumentsSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [capabilities, params] = await Promise.all([
    requirePeopleManageAccess(),
    searchParams,
  ]);

  const sessionUser = await getCurrentUser();
  if (!sessionUser || sessionUser.id !== capabilities.userId) {
    return null;
  }

  const filters: OrgCorrespondenceSearchFilters = {
    query: params.query,
    category: params.category,
    status: params.status,
    subType: params.subType,
    overdueAck: params.overdueAck === "1",
    expiringRetention: params.expiringRetention === "1",
    pastRetention: params.pastRetention === "1",
    issueFrom: params.issueFrom,
    issueTo: params.issueTo,
  };

  const [result, pastRetentionCount] = await Promise.all([
    searchOrgCorrespondence(sessionUser.organizationId, filters),
    countPastRetentionCorrespondence(sessionUser.organizationId),
  ]);

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Documents"
        description="Org-wide employee file search"
        actions={
          <>
            <ArchiveExpiredRetentionButton />
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/people/documents/templates" />}
            >
              <FileText />
              Letter templates
            </Button>
          </>
        }
      />

      {pastRetentionCount > 0 ? (
        <PageAlert severity="warning" title="Retention expired">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0" />
            {pastRetentionCount} letter{pastRetentionCount === 1 ? "" : "s"} past
            retention date.{" "}
            <Link
              href="/people/documents?pastRetention=1"
              className="font-medium underline underline-offset-2"
            >
              View past retention
            </Link>{" "}
            or use Archive expired now.
          </span>
        </PageAlert>
      ) : null}

      <section className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/people/documents/missing"
          className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
        >
          Missing documents
        </Link>
        <Link
          href="/people/documents/expiring"
          className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
        >
          Expiring credentials
        </Link>
        <Link
          href="/people/documents?expiringRetention=1"
          className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
        >
          Expiring retention
        </Link>
        <Link
          href="/people/documents?pastRetention=1"
          className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
        >
          Past retention ({pastRetentionCount})
        </Link>
      </section>

      <form className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="query">
            Search
          </label>
          <Input
            id="query"
            name="query"
            defaultValue={filters.query ?? ""}
            placeholder="Employee name, number, title…"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            defaultValue={filters.category ?? ""}
          >
            <option value="">All</option>
            {CORRESPONDENCE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            defaultValue={filters.status ?? ""}
          >
            <option value="">All</option>
            {CORRESPONDENCE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="subType">
            Tag
          </label>
          <Input
            id="subType"
            name="subType"
            defaultValue={filters.subType ?? ""}
            placeholder="FIRST_WARNING…"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="issueFrom">
            Issued from
          </label>
          <Input
            id="issueFrom"
            name="issueFrom"
            type="date"
            defaultValue={filters.issueFrom ?? ""}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="issueTo">
            Issued to
          </label>
          <Input
            id="issueTo"
            name="issueTo"
            type="date"
            defaultValue={filters.issueTo ?? ""}
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="overdueAck"
              value="1"
              defaultChecked={filters.overdueAck}
            />
            Overdue acknowledgements
          </label>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="expiringRetention"
              value="1"
              defaultChecked={filters.expiringRetention}
            />
            Expiring retention
          </label>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="pastRetention"
              value="1"
              defaultChecked={filters.pastRetention}
            />
            Past retention
          </label>
        </div>
        <div className="md:col-span-4">
          <Button type="submit">Search</Button>
        </div>
      </form>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Results ({result.total})
          </h2>
        </div>

        {result.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching letters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm md:min-w-[960px]">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">
                    Issued
                  </th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">
                    Effective
                  </th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">
                    Acknowledgement
                  </th>
                  <th className="px-3 py-3 font-medium">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {result.items.map((item) => (
                  <EmployeeDirectoryRow
                    key={item.id}
                    href={item.detailHref}
                    label={`View ${item.title} for ${item.employeeName}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <span className="font-medium group-hover:underline">
                        {item.employeeName}
                      </span>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {item.employeeNumber}
                      </p>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <span>{label(item.category)}</span>
                      {item.subType ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.subType}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-3 py-3 align-top">{item.title}</td>

                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={correspondenceStatusBadgeVariant(item.status)}
                        >
                          {label(item.status)}
                        </Badge>
                        {item.isAckOverdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : null}
                      </div>
                    </td>

                    <td className="hidden px-3 py-3 align-top md:table-cell">
                      {item.issueDate ? formatDate(item.issueDate) : "—"}
                    </td>

                    <td className="hidden px-3 py-3 align-top lg:table-cell">
                      {formatDate(item.effectiveDate)}
                    </td>

                    <td className="hidden px-3 py-3 align-top text-xs text-muted-foreground lg:table-cell">
                      {item.requiresAcknowledgement
                        ? item.status === "ACKNOWLEDGED"
                          ? "Acknowledged"
                          : "Required"
                        : "—"}
                    </td>

                    <td className="px-3 py-3 text-right align-top">
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </td>
                  </EmployeeDirectoryRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
