import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { getOrgLifecycleQueuePageData } from "@/src/modules/hr/data/get-org-lifecycle-queue-page";

export const metadata: Metadata = {
  title: "Hire / exit queue",
};

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
  }).format(value);
}

export default async function PeopleLifecycleQueuePage() {
  const data = await getOrgLifecycleQueuePageData();

  return (
    <PageShell>
      <PeoplePageHeader
        title="Hire / exit queue"
        description="Open onboarding and offboarding cases across the organization."
      />

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open hire or exit cases right now.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Case</th>
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Progress</th>
                <th className="py-2 pr-3 font-medium">Opened</th>
                <th className="py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={`${item.kind}-${item.caseId}`} className="border-b border-border/70">
                  <td className="py-3 pr-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">
                        {item.kind === "onboarding" ? "Onboarding" : "Offboarding"}
                      </Badge>
                      <span className="font-medium">
                        {item.caseNumber ?? item.caseId.slice(0, 8)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/people/employees/${item.employeeId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.employeeNumber} — {item.employeeName}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {(item.caseTypeOrReason ?? "—").replaceAll("_", " ")}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.status}</span>
                      {item.atRisk ? (
                        <Badge variant="destructive" className="w-fit">
                          At risk
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{item.progressPercent}%</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {formatDate(item.openedAt)}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {item.ownerName ?? "—"}
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
