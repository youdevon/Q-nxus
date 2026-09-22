import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/src/components/layout/page-shell";
import { cn } from "@/lib/utils";
import { EmployeeEntityNav } from "@/src/modules/hr/components/employee-entity-nav";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import type { EmployeeEntityChrome } from "@/src/modules/hr/data/get-employee-entity-chrome";
import type { EmployeeEntityTabId } from "@/src/modules/hr/lib/employee-entity-tabs";
import {
  employeeLeadershipAccentClass,
  employeeLeadershipBadgeClass,
  employeeHeaderBadgeLabel,
} from "@/src/modules/hr/lib/employee-leadership-role";

type EmployeeSectionChromeProps = {
  chrome: EmployeeEntityChrome;
  current: EmployeeEntityTabId;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
};

/**
 * Shared People header + section tabs for employee-linked pages.
 */
export function EmployeeSectionChrome({
  chrome,
  current,
  title,
  description,
  actions,
  children,
  size = "lg",
}: EmployeeSectionChromeProps) {
  return (
    <PageShell size={size}>
      <PeoplePageHeader
        title={title}
        description={
          description ??
          (chrome.workforceCategory === "BOARD"
            ? `${chrome.displayName} · Board member`
            : `${chrome.displayName} · ${chrome.employeeNumber}`)
        }
        backHref={`/people/employees/${chrome.id}`}
        backLabel={chrome.workforceCategory === "BOARD" ? "Board member" : "Employee"}
        actions={actions}
        badge={
          <Badge
            variant="outline"
            className={cn(
              employeeLeadershipBadgeClass(chrome.leadershipRole),
            )}
          >
            {employeeHeaderBadgeLabel(
              chrome.leadershipRole,
              chrome.positionTitle,
            )}
          </Badge>
        }
        titleAccentClassName={employeeLeadershipAccentClass(
          chrome.leadershipRole,
        )}
      />

      <EmployeeEntityNav
        employeeId={chrome.id}
        current={current}
        workforceCategory={chrome.workforceCategory}
        isFullEmployee={chrome.isFullEmployee}
      />

      {children}
    </PageShell>
  );
}
