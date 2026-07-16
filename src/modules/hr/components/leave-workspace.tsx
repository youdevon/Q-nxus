import Link from "next/link"
import {
  CalendarDays,
  ClipboardList,
  Plus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import type { LeaveWorkspaceData } from "@/src/modules/hr/data/get-leave-requests"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "APPROVED":
      return "default"
    case "REJECTED":
    case "CANCELLED":
      return "destructive"
    case "WITHDRAWN":
      return "outline"
    case "PENDING_APPROVAL":
    case "SUBMITTED":
      return "secondary"
    default:
      return "outline"
  }
}

function RequestList({
  title,
  emptyMessage,
  requests,
}: {
  title: string
  emptyMessage: string
  requests: LeaveWorkspaceData["myRequests"]
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h2>
      </div>

      {requests.length === 0 ? (
        <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/leave/${request.id}`}
              className="grid gap-5 py-5 hover:bg-muted/20 md:grid-cols-[1fr_12rem_8rem_9rem]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {request.leaveTypeName}
                  </p>
                  <Badge variant={statusVariant(request.status)}>
                    {label(request.status)}
                  </Badge>
                </div>

                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {request.requestNumber ?? request.id}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  {request.employeeName} · {request.jobTitle}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Dates
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(request.startDate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  to {formatDate(request.endDate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Days
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatQuantity(request.requestedQuantity)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Contract
                </p>
                <p className="mt-1 text-sm font-medium">
                  {request.contractNumber ?? "—"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export function LeaveWorkspace({
  data,
}: {
  data: LeaveWorkspaceData
}) {
  const pendingCount = data.myRequests.filter(
    (request) =>
      request.status === "PENDING_APPROVAL" ||
      request.status === "SUBMITTED",
  ).length

  const approvedCount = data.myRequests.filter(
    (request) => request.status === "APPROVED",
  ).length

  return (
    <PageShell size="lg">
      <PageHeader
        title="Leave"
        description={`${data.user.employeeName} · balances, requests, and approvals`}
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/leave/new" />}
          >
            <Plus />
            Request leave
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            My requests
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.myRequests.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Awaiting decision
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {pendingCount}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Approved
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {approvedCount}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Pending my approval
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.pendingApprovals.length}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Current balances
          </h2>
        </div>

        {data.balances.length === 0 ? (
          <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
            No leave balances on your current contract.
          </p>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium">
                    Leave type
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Reserved
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Taken
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Available
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map((balance) => (
                  <tr
                    key={balance.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-4">
                      <p className="font-medium">
                        {balance.leaveTypeName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {balance.leaveTypeCode}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-right">
                      {formatQuantity(balance.reserved)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      {formatQuantity(balance.taken)}
                    </td>
                    <td className="px-3 py-4 text-right font-semibold">
                      {formatQuantity(balance.availableBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.pendingApprovals.length > 0 && (
        <RequestList
          title="Awaiting my approval"
          emptyMessage=""
          requests={data.pendingApprovals}
        />
      )}

      <RequestList
        title="My leave requests"
        emptyMessage="You have not submitted any leave requests yet."
        requests={data.myRequests}
      />
    </PageShell>
  )
}
