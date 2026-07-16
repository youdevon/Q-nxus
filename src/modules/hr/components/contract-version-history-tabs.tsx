"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/src/lib/format";
import type { EmploymentContractProfile } from "@/src/modules/hr/data/get-employment-contracts";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ContractVersionHistoryTabs({
  employeeId,
  previousVersions,
}: {
  employeeId: string;
  previousVersions: EmploymentContractProfile["previousVersions"];
}) {
  const [tab, setTab] = useState<"current" | "previous">("current");

  if (previousVersions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Amendment history
        </h2>

        <div
          className="flex gap-1 border-b border-border"
          role="tablist"
          aria-label="Contract version views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "current"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === "current"
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("current")}
          >
            Current version
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "previous"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === "previous"
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("previous")}
          >
            Previous versions ({previousVersions.length})
          </button>
        </div>
      </div>

      {tab === "current" ? (
        <p className="text-sm text-muted-foreground">
          You are viewing the current contract version above. Open previous
          versions to compare superseded records.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {previousVersions.map((version) => (
            <Link
              key={version.id}
              href={`/people/employees/${employeeId}/contracts/${version.id}`}
              className="grid gap-4 py-5 hover:bg-muted/20 md:grid-cols-[1fr_10rem_10rem]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{version.jobTitle}</p>
                  <Badge variant="outline">{label(version.changeType)}</Badge>
                  <Badge variant="secondary">{label(version.status)}</Badge>
                  {version.collectedAt ? (
                    <Badge variant="secondary">Collected</Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {version.contractNumber ?? "No contract number"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="mt-1 text-sm font-medium">{version.startDate}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  to {version.endDate ?? "No end date"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Base salary</p>
                <p className="mt-1 text-sm font-medium">
                  {formatMoney(version.baseSalary, {
                    currency: version.currency,
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
