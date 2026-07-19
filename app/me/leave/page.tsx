import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { leaveStatusBadgeVariant } from "@/src/config/ui-colors";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { getMyLeaveRequests } from "@/src/modules/hr/data/get-leave-requests";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";
import { formatDisplayDate } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "My Leave Requests",
};

export const dynamic = "force-dynamic";

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

export default async function MyLeavePage() {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.can("leave.request")) {
    redirect("/me");
  }

  const user = await getCurrentUser();
  if (!requiresEmployeeFile(user?.employee?.workforceCategory)) {
    redirect("/me");
  }

  const requests = await getMyLeaveRequests();

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My leave requests"
        description="Leave you have submitted for yourself."
        backHref="/me"
        backLabel="My profile"
        actions={
          <Button nativeButton={false} render={<Link href="/me/leave/new" />}>
            <Plus />
            Request leave
          </Button>
        }
      />

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
