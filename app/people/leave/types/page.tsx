import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileCheck2, Plus, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { getLeaveTypes } from "@/src/modules/hr/data/get-leave-types";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Leave Types",
};

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
  await requireLeaveManageAccess();

  const leaveTypes = await getLeaveTypes();

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Leave Types"
        description="Configure the leave categories, balance requirements and supporting-document rules used throughout the platform."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/people/leave/types/new" />}
          >
            <Plus />
            New leave type
          </Button>
        }
      />

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Leave types</p>
          <p className="mt-1 text-2xl font-semibold">{leaveTypes.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">
            {leaveTypes.filter((leaveType) => leaveType.isActive).length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Requires balance</p>
          <p className="mt-1 text-2xl font-semibold">
            {leaveTypes.filter((leaveType) => leaveType.requiresBalance).length}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Configured leave
          </h2>
        </div>

        {leaveTypes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No leave types have been configured.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {leaveTypes.map((leaveType) => (
              <Link
                key={leaveType.id}
                href={`/people/leave/types/${leaveType.id}`}
                className="grid gap-6 py-6 hover:bg-muted/20 lg:grid-cols-[1fr_10rem_10rem_10rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{leaveType.name}</p>

                    <Badge variant="outline">{leaveType.code}</Badge>

                    <Badge
                      variant={activeStateBadgeVariant(leaveType.isActive)}
                    >
                      {leaveType.isActive ? "Active" : "Inactive"}
                    </Badge>

                    <Badge variant="secondary">
                      {leaveType.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {leaveType.description ?? "No description provided."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-4" />
                      {leaveType.entitlementRuleCount}
                      {" "}
                      entitlement rule
                      {leaveType.entitlementRuleCount === 1 ? "" : "s"}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <FileCheck2 className="size-4" />
                      {leaveType.requiresDocument
                        ? `Document required${
                            leaveType.documentRequiredAfter
                              ? ` after ${leaveType.documentRequiredAfter} days`
                              : ""
                          }`
                        : "No document required"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Notice</p>
                  <p className="mt-1 text-sm font-medium">
                    {leaveType.minimumNoticeDays} day
                    {leaveType.minimumNoticeDays === 1 ? "" : "s"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Carry forward</p>
                  <p className="mt-1 text-sm font-medium">
                    {leaveType.carryForwardAllowed
                      ? leaveType.carryForwardLimit
                        ? `Up to ${leaveType.carryForwardLimit}`
                        : "Allowed"
                      : "Not allowed"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Employee balances
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {leaveType.employeeBalanceCount}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
