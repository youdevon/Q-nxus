import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UI_MOTION } from "@/src/config/ui-typography";
import {
  employeeEntityTabs,
  type EmployeeEntityTabId,
} from "@/src/modules/hr/lib/employee-entity-tabs";
import {
  employeeLeadershipBadgeClass,
  employeeHeaderBadgeLabel,
  type EmployeeLeadershipRole,
} from "@/src/modules/hr/lib/employee-leadership-role";

type EmployeeEntityNavProps = {
  employeeId: string;
  current: EmployeeEntityTabId;
  workforceCategory?: string | null;
  isFullEmployee?: boolean;
  leadershipRole?: EmployeeLeadershipRole;
  positionTitle?: string | null;
  className?: string;
};

/**
 * Sibling tabs under the employee page header (profile, contracts, file, …).
 */
export function EmployeeEntityNav({
  employeeId,
  current,
  workforceCategory,
  isFullEmployee,
  leadershipRole,
  positionTitle,
  className,
}: EmployeeEntityNavProps) {
  const tabs = employeeEntityTabs({
    employeeId,
    current,
    workforceCategory,
    isFullEmployee,
  });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3",
        className,
      )}
    >
      <nav
        aria-label="Employee sections"
        className="flex flex-wrap items-center gap-1"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium",
              UI_MOTION.control,
              tab.current ? UI_MOTION.tabActive : UI_MOTION.tabIdle,
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {leadershipRole ? (
        <Badge
          variant="outline"
          className={cn(employeeLeadershipBadgeClass(leadershipRole))}
        >
          {employeeHeaderBadgeLabel(leadershipRole, positionTitle)}
        </Badge>
      ) : null}
    </div>
  );
}
