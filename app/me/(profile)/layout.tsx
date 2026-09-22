import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { cn } from "@/lib/utils";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { MeProfileTabs } from "@/src/modules/hr/components/me-profile-tabs";
import { getMeChrome } from "@/src/modules/hr/data/get-me-chrome";
import {
  employeeHeaderBadgeLabel,
  employeeLeadershipAccentClass,
  employeeLeadershipBadgeClass,
} from "@/src/modules/hr/lib/employee-leadership-role";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Profile chrome for /me/* — intentionally NOT applied to print routes
 * (e.g. /me/payslip/print), which live outside this route group.
 */
export default async function MeProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const chrome = await getMeChrome();
  const leadershipRole = chrome.leadershipRole;

  return (
    <PageShell size="lg">
      <MePageHeader
        title={chrome.displayName}
        description={
          chrome.workforceCategory === "BOARD" || !chrome.employeeNumber
            ? "Your record"
            : `Your record · ${chrome.employeeNumber}`
        }
        icon={null}
        titleAccentClassName={employeeLeadershipAccentClass(leadershipRole)}
        badge={
          <>
            <Badge
              variant="outline"
              className={cn(employeeLeadershipBadgeClass(leadershipRole))}
            >
              {employeeHeaderBadgeLabel(leadershipRole, chrome.positionTitle)}
            </Badge>
            {chrome.employmentStatus ? (
              <Badge
                variant={employmentStatusBadgeVariant(chrome.employmentStatus)}
              >
                {label(chrome.employmentStatus)}
              </Badge>
            ) : null}
            {chrome.employmentType ? (
              <Badge variant="outline">{label(chrome.employmentType)}</Badge>
            ) : null}
          </>
        }
      />
      <MeProfileTabs />
      {children}
      <p className="text-xs text-muted-foreground">
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy notice
        </Link>
        {" — how we use personal information in this system."}
      </p>
    </PageShell>
  );
}
