import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { getTeamManagerVisibleLetters } from "@/src/modules/hr/data/get-team-documents";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { formatDisplayDate } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "Team documents",
};

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function TeamDocumentsPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.employeeId) {
    redirect("/");
  }

  const { reports, letters } = await getTeamManagerVisibleLetters(
    capabilities.employeeId,
  );

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Team documents"
        description="Manager-visible letters for your direct reports"
      />

      {reports.length === 0 ? (
        <PageAlert severity="information" title="No direct reports">
          You do not currently have direct reports with a reporting line to your
          position.
        </PageAlert>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SectionHeading>Direct reports</SectionHeading>
          <Badge variant="outline">{reports.length}</Badge>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports found.</p>
        ) : (
          <div className="divide-y divide-border/70">
            {reports.map((report) => (
              <article
                key={report.employeeId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <Link
                    href={`/people/employees/${report.employeeId}/documents`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {report.displayName}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      report.employeeNumber,
                      report.positionTitle,
                      report.departmentName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge variant="secondary">
                  {report.managerVisibleLetterCount} shared letter
                  {report.managerVisibleLetterCount === 1 ? "" : "s"}
                </Badge>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SectionHeading>Shared letters</SectionHeading>
          <Badge variant="outline">{letters.length}</Badge>
        </div>
        {letters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No manager-visible letters have been shared for your reports.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {letters.map((letter) => (
              <Link
                key={letter.id}
                href={letter.detailHref}
                className="flex flex-col gap-1 py-3 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{letter.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {letter.employeeName} · {letter.employeeNumber} ·{" "}
                    {label(letter.category)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{label(letter.status)}</Badge>
                  <span className="text-muted-foreground">
                    {letter.issueDate ? formatDate(letter.issueDate) : "—"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
