import Link from "next/link";
import { ClipboardList, Plus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { leaveStatusBadgeVariant } from "@/src/config/ui-colors";
import type { LeaveWorkspaceData } from "@/src/modules/hr/data/get-leave-requests";
import type { VacationForfeitureWarning } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function RequestList({
  title,
  description,
  emptyMessage,
  requests,
  showEmployee = false,
  anchorId,
}: {
  title: string;
  description?: string;
  emptyMessage: string;
  requests: LeaveWorkspaceData["myRequests"];
  showEmployee?: boolean;
  anchorId?: string;
}) {
  return (
    <section id={anchorId}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <SectionHeading>{title}</SectionHeading>
        </div>

        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/leave/${request.id}`}
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
                  {showEmployee ? ` · ${request.employeeName}` : ""}
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
  );
}

function CurrentlyOnLeaveToggle({
  count,
  selected,
}: {
  count: number;
  selected: boolean;
}) {
  const labelText =
    count === 1
      ? "1 person currently on leave"
      : `${count} people currently on leave`;

  return (
    <div className="border-b border-border pb-5">
      <Button
        nativeButton={false}
        variant={selected ? "secondary" : "outline"}
        size="sm"
        aria-pressed={selected}
        render={
          <Link
            href={selected ? "/leave" : "/leave?view=on-leave"}
            scroll={false}
          />
        }
      >
        <Users />
        {labelText}
      </Button>
    </div>
  );
}

function CurrentlyOnLeaveRoster({
  entries,
}: {
  entries: LeaveWorkspaceData["currentlyOnLeave"];
}) {
  return (
    <section>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <SectionHeading>Currently on leave</SectionHeading>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved leave overlapping today.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No one is currently on leave.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/leave/${entry.id}`}
              className="grid gap-4 py-5 hover:bg-muted/20 md:grid-cols-[1fr_12rem_14rem]"
            >
              <div>
                <p className="font-medium">{entry.employeeName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.employeeNumber}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Leave type</p>
                <p className="mt-1 text-sm font-medium">
                  {entry.leaveTypeName}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Dates</p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(entry.startDate)} –{" "}
                  {formatDate(entry.endDate)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function LeaveWorkspace({
  data,
  view = "default",
  vacationForfeitureWarning = null,
}: {
  data: LeaveWorkspaceData;
  view?: "default" | "on-leave";
  vacationForfeitureWarning?: VacationForfeitureWarning | null;
}) {
  const isOnLeaveView = view === "on-leave";
  const isOrgView = data.statsScope === "org";
  const daysTakenLabel = isOrgView
    ? "Days taken (organization)"
    : "Your days taken";
  const pendingLabel = isOrgView
    ? "Pending requests (organization)"
    : "Your requests awaiting decision";
  const approvedLabel = isOrgView
    ? "Approved YTD (organization)"
    : "Your approved days YTD";

  const pageDescription = isOnLeaveView
    ? "People with approved leave overlapping today"
    : data.canManageLeave
      ? "Organization leave queues: awaiting manager, needs HR confirmation, and your requests"
      : data.canApprove
        ? "Your leave requests and requests awaiting your approval"
        : "Your leave requests and summary";

  const showHrQueues = data.canManageLeave;
  const showManagerQueue = data.canApprove && !showHrQueues;
  const showAssignedWhileHr =
    showHrQueues && data.pendingMyApprovals.length > 0;
  const attentionCount = showHrQueues
    ? data.stats.pendingHrConfirmationCount
    : data.stats.pendingMyApprovalCount;
  const attentionHref = showHrQueues ? "/leave#hr-queue" : "/leave#approvals";
  const attentionLabel = showHrQueues
    ? "Needs HR confirmation"
    : "Awaiting my approval";
  const statColumns = data.canApprove || data.canManageLeave ? 4 : 3;

  return (
    <PageShell size="lg">
      <PageHeader
        title="Leave"
        description={pageDescription}
        actions={
          <Button nativeButton={false} render={<Link href="/leave/new" />}>
            <Plus />
            Request leave
          </Button>
        }
      />

      {vacationForfeitureWarning && !isOnLeaveView ? (
        <PageAlert
          severity={vacationForfeitureWarning.isUrgent ? "critical" : "warning"}
          title="Mandatory vacation cannot roll over"
        >
          <p>{vacationForfeitureWarning.message}</p>
          <p className="mt-2">
            <Link
              href="/leave/new"
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Request vacation leave
            </Link>{" "}
            so it finishes on or before{" "}
            {vacationForfeitureWarning.contractEndDateIso}.
          </p>
        </PageAlert>
      ) : null}

      <CurrentlyOnLeaveToggle
        count={data.stats.currentlyOnLeaveCount}
        selected={isOnLeaveView}
      />

      {isOnLeaveView ? (
        <CurrentlyOnLeaveRoster entries={data.currentlyOnLeave} />
      ) : (
        <>
          <section
            className={[
              "grid grid-cols-2 gap-8",
              statColumns === 4 ? "md:grid-cols-4" : "md:grid-cols-3",
            ].join(" ")}
          >
            <div>
              <p className="text-xs text-muted-foreground">{daysTakenLabel}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatQuantity(data.stats.daysTaken)}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{pendingLabel}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.stats.pendingRequestsCount}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{approvedLabel}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatQuantity(data.stats.approvedYtdDays)}
              </p>
            </div>

            {data.canApprove || data.canManageLeave ? (
              <Link
                href={attentionHref}
                className="block rounded-lg border border-transparent px-3 py-2 -mx-3 transition-colors hover:border-border/80 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs text-muted-foreground">{attentionLabel}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {attentionCount}
                </p>
              </Link>
            ) : null}
          </section>

          {showHrQueues ? (
            <>
              <RequestList
                anchorId="hr-queue"
                title="Needs HR confirmation"
                description="Manager-approved leave that needs HR acknowledgement before it is final."
                emptyMessage="No leave requests are waiting for HR confirmation."
                requests={data.pendingHrConfirmations}
                showEmployee
              />

              <RequestList
                anchorId="manager-queue"
                title="Awaiting manager approval"
                description="Submitted leave still with the employee’s manager (from reporting lines)."
                emptyMessage="No leave requests are waiting for a manager decision."
                requests={data.pendingManagerApprovals}
                showEmployee
              />

              {showAssignedWhileHr ? (
                <RequestList
                  anchorId="approvals"
                  title="Assigned to me"
                  description="Leave where you are the reporting-line approver."
                  emptyMessage="No leave requests are assigned to you."
                  requests={data.pendingMyApprovals}
                  showEmployee
                />
              ) : null}
            </>
          ) : null}

          {showManagerQueue ? (
            <RequestList
              anchorId="approvals"
              title="Awaiting my approval"
              description="Leave requests from your team that need your decision."
              emptyMessage="No leave requests are waiting for your approval."
              requests={data.pendingMyApprovals}
              showEmployee
            />
          ) : null}

          <RequestList
            title="My leave requests"
            description="Requests you have submitted."
            emptyMessage="You have not submitted any leave requests yet."
            requests={data.myRequests}
          />
        </>
      )}
    </PageShell>
  );
}
