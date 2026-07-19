import Link from "next/link";
import { ClipboardList, Plus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { leaveStatusBadgeVariant } from "@/src/config/ui-colors";
import type { LeaveWorkspaceData } from "@/src/modules/hr/data/get-leave-requests";
import type { VacationForfeitureWarning } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import type { VacationForfeitureQueueItem } from "@/src/modules/hr/data/get-vacation-forfeiture-queue";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { formatDisplayDate } from "@/src/lib/format";

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
  requests: LeaveWorkspaceData["allRequests"];
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
            href={selected ? "/people/leave" : "/people/leave?view=on-leave"}
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
              href={`/people/leave/${entry.id}`}
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
  vacationForfeitureQueue = [],
}: {
  data: LeaveWorkspaceData;
  view?: "default" | "on-leave";
  vacationForfeitureWarning?: VacationForfeitureWarning | null;
  vacationForfeitureQueue?: VacationForfeitureQueueItem[];
}) {
  const isOnLeaveView = view === "on-leave";
  const pageDescription = isOnLeaveView
    ? "People with approved leave overlapping today"
    : data.canManageLeave
      ? "Manage organization leave: queues, people currently out, and all employee requests."
      : data.canApprove
        ? "Review team approvals and browse all employee leave requests."
        : "Browse and manage leave requests across the organization.";

  const showHrQueues = data.canManageLeave;
  const showManagerQueue = data.canApprove && !showHrQueues;
  const showAssignedWhileHr =
    showHrQueues && data.pendingMyApprovals.length > 0;
  const attentionCount = showHrQueues
    ? data.stats.pendingHrConfirmationCount
    : data.stats.pendingMyApprovalCount;
  const attentionHref = showHrQueues
    ? "/people/leave#hr-queue"
    : "/people/leave#approvals";
  const attentionLabel = showHrQueues
    ? "Needs HR confirmation"
    : "Awaiting my approval";
  const showAttentionStat = data.canApprove || data.canManageLeave;
  const statColumns = showAttentionStat ? 4 : 3;

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Leave"
        description={pageDescription}
        actions={
          data.canManageLeave ? (
            <Button
              nativeButton={false}
              render={<Link href="/people/leave/new" />}
            >
              <Plus />
              Request leave for employee
            </Button>
          ) : undefined
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
              href="/me/leave/new"
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
              <p className="text-xs text-muted-foreground">
                Days taken (organization)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatQuantity(data.stats.daysTaken)}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Pending requests (organization)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.stats.pendingRequestsCount}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Approved YTD (organization)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatQuantity(data.stats.approvedYtdDays)}
              </p>
            </div>

            {showAttentionStat ? (
              <Link
                href={attentionHref}
                className="-mx-3 block rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border/80 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
              {vacationForfeitureQueue.length > 0 ? (
                <section id="vacation-forfeiture">
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      <SectionHeading>Vacation use-or-lose</SectionHeading>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Current contracts ending within 30 days with unused
                      vacation that cannot roll over.
                    </p>
                  </div>

                  <div className="divide-y divide-border/70">
                    {vacationForfeitureQueue.map((item) => (
                      <div
                        key={item.contractId}
                        className="grid gap-3 py-4 md:grid-cols-[1fr_8rem_8rem_auto]"
                      >
                        <div>
                          <p className="font-medium">{item.employeeName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.employeeNumber}
                            {item.contractNumber
                              ? ` · ${item.contractNumber}`
                              : ""}
                            {" · "}
                            {item.jobTitle}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Days left
                          </p>
                          <p className="mt-1 text-sm font-medium tabular-nums">
                            {item.daysUntilEnd < 0
                              ? "Ended"
                              : item.daysUntilEnd}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Available VAC
                          </p>
                          <p className="mt-1 text-sm font-medium tabular-nums">
                            {formatQuantity(String(item.availableDays))}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <Badge
                            variant={item.isUrgent ? "destructive" : "outline"}
                          >
                            Ends {formatDate(item.contractEndDateIso)}
                          </Badge>
                          <Button
                            nativeButton={false}
                            variant="outline"
                            size="sm"
                            render={
                              <Link
                                href={`/people/leave/balances?employeeId=${item.employeeId}`}
                              />
                            }
                          >
                            Balances
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

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
            <>
              {data.pendingMyAcknowledgements.length > 0 ? (
                <RequestList
                  anchorId="acknowledgements"
                  title="Awaiting my acknowledgement"
                  description="Leave in your reporting line that needs acknowledgement before final approval."
                  emptyMessage="No leave requests are waiting for your acknowledgement."
                  requests={data.pendingMyAcknowledgements}
                  showEmployee
                />
              ) : null}

              <RequestList
                anchorId="approvals"
                title="Awaiting my approval"
                description="Leave requests from your team that need your decision."
                emptyMessage="No leave requests are waiting for your approval."
                requests={data.pendingMyApprovals}
                showEmployee
              />
            </>
          ) : null}

          {showHrQueues && data.pendingMyAcknowledgements.length > 0 ? (
            <RequestList
              anchorId="acknowledgements"
              title="Awaiting my acknowledgement"
              description="Leave in your reporting line that needs acknowledgement before final approval."
              emptyMessage="No leave requests are waiting for your acknowledgement."
              requests={data.pendingMyAcknowledgements}
              showEmployee
            />
          ) : null}

          <RequestList
            title="All leave requests"
            description="Every employee leave request in the organization, including your own."
            emptyMessage="No leave requests have been submitted yet."
            requests={data.allRequests}
            showEmployee
          />
        </>
      )}
    </PageShell>
  );
}
