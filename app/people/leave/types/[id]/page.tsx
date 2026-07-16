import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { LeaveEntitlementRuleForm } from "@/src/modules/hr/components/leave-entitlement-rule-form";
import { PeopleNav } from "@/src/modules/hr/components/people-nav";
import { RebuildLeaveBalancesButton } from "@/src/modules/hr/components/rebuild-leave-balances-button";
import { getLeaveTypeDetail } from "@/src/modules/hr/data/get-leave-types";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Leave Type",
};

export const dynamic = "force-dynamic";

export default async function LeaveTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireLeaveManageAccess();

  const { id } = await params;
  const leaveType = await getLeaveTypeDetail(id);

  if (!leaveType) {
    notFound();
  }

  return (
    <PageShell>
      <PeopleNav />

      <PageHeader
        title={leaveType.name}
        description={
          leaveType.description ??
          "Leave type configuration and entitlement rules."
        }
        backHref="/people/leave/types"
        backLabel="Leave types"
        actions={
          <Button
            nativeButton={false}
            render={<Link href={`/people/leave/types/${leaveType.id}/edit`} />}
          >
            <Pencil />
            Edit
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Code</p>
          <p className="mt-1 font-mono text-sm font-medium">{leaveType.code}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-1">
            <Badge variant={activeStateBadgeVariant(leaveType.isActive)}>
              {leaveType.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="mt-1 text-sm font-medium">
            {leaveType.requiresBalance ? "Required" : "Not required"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Documents</p>
          <p className="mt-1 text-sm font-medium">
            {leaveType.requiresDocument
              ? leaveType.documentRequiredAfter
                ? `After ${leaveType.documentRequiredAfter} days`
                : "Required"
              : "Not required"}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Entitlement rules
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <RebuildLeaveBalancesButton leaveTypeId={leaveType.id} />
            <Badge variant="secondary">
              {leaveType.entitlementRules.length} rule
              {leaveType.entitlementRules.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        {leaveType.entitlementRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entitlement rules yet. Add one below.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {leaveType.entitlementRules.map((rule) => (
              <article key={rule.id} className="grid gap-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{rule.name}</p>
                  <Badge variant={activeStateBadgeVariant(rule.isActive)}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">{rule.accrualMethod}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rule.annualEntitlement} days · priority {rule.priority}
                  {rule.employmentType
                    ? ` · ${rule.employmentType}`
                    : " · any employment type"}
                  {" ·"}
                  {rule.effectiveFrom}
                  {rule.effectiveTo ? ` to ${rule.effectiveTo}` : " onward"}
                </p>
              </article>
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Plus className="size-4" />
            Add entitlement rule
          </h3>
          <LeaveEntitlementRuleForm leaveTypeId={leaveType.id} />
        </div>
      </section>
    </PageShell>
  );
}
