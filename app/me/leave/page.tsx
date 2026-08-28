import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, ClipboardList, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { leaveStatusBadgeVariant } from "@/src/config/ui-colors";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { getContractLeaveBalances } from "@/src/modules/hr/data/get-contract-leave-balances";
import { getMyLeaveRequests } from "@/src/modules/hr/data/get-leave-requests";
import { getVacationForfeitureWarningForEmployee } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";
import { formatDisplayDate } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "My Leave Requests",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  focus?: string;
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

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default async function MyLeavePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.can("leave.request")) {
    redirect("/me");
  }

  const user = await getCurrentUser();
  if (!requiresEmployeeFile(user?.employee?.workforceCategory)) {
    redirect("/me");
  }

  const employeeId = capabilities.employeeId;
  if (!employeeId) {
    redirect("/me");
  }

  const params = await searchParams;
  const focusForfeiture = params.focus === "forfeiture";

  const [requests, balances, forfeitureWarning] = await Promise.all([
    getMyLeaveRequests(),
    getContractLeaveBalances({ employeeId }),
    getVacationForfeitureWarningForEmployee(employeeId),
  ]);

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My leave"
        description="Your current-contract leave balances and requests."
        backHref="/me"
        backLabel="My profile"
        actions={
          <Button nativeButton={false} render={<Link href="/me/leave/new" />}>
            <Plus />
            Request leave
          </Button>
        }
      />

      {forfeitureWarning ? (
        <PageAlert
          severity={forfeitureWarning.isUrgent ? "critical" : "warning"}
          title={
            focusForfeiture
              ? "Vacation use-or-lose — opened from alert"
              : "Mandatory vacation cannot roll over"
          }
        >
          <p>{forfeitureWarning.message}</p>
          <p className="mt-2">
            <Link
              href="/me/leave/new"
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Request vacation leave
            </Link>{" "}
            so it finishes on or before {forfeitureWarning.contractEndDateIso}.
          </p>
        </PageAlert>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SectionHeading>Current contract balances</SectionHeading>
        </div>

        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leave balances on your current employment contract yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Leave type</th>
                  <th className="px-3 py-3 text-right font-medium">
                    Entitlement
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Approved</th>
                  <th className="px-3 py-3 text-right font-medium">Taken</th>
                  <th className="px-3 py-3 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => {
                  const highlightVac =
                    focusForfeiture &&
                    balance.leaveTypeCode === "VAC" &&
                    Number(balance.availableBalance) > 0;

                  return (
                    <tr
                      key={balance.id}
                      className={
                        highlightVac
                          ? "border-b border-border bg-amber-500/10"
                          : "border-b border-border last:border-b-0"
                      }
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{balance.leaveTypeName}</span>
                          <Badge variant="outline">{balance.leaveTypeCode}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatQuantity(balance.entitlement)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatQuantity(balance.approved)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatQuantity(balance.taken)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatQuantity(balance.availableBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <SectionHeading>Your requests</SectionHeading>
        </div>

        {requests.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              You have not submitted any leave requests yet.
            </p>
            <Button
              nativeButton={false}
              className="mt-4"
              render={<Link href="/me/leave/new" />}
            >
              <Plus />
              Request leave
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/people/leave/${request.id}`}
                className="grid gap-4 py-5 hover:bg-muted/20 md:grid-cols-[1fr_11rem_6rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{request.leaveTypeName}</p>
                    <Badge variant={leaveStatusBadgeVariant(request.status)}>
                      {label(request.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.requestNumber ?? "Leave request"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Dates</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(request.startDate)} –{" "}
                    {formatDate(request.endDate)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Days</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {formatQuantity(request.requestedQuantity)}
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
