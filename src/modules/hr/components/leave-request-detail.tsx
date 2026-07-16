import Link from "next/link"
import {
  ArrowLeft,
  CalendarRange,
  CircleCheck,
  MessageSquareText,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { LeaveDecisionForm } from "@/src/modules/hr/components/leave-decision-form"
import { LeaveLifecycleActions } from "@/src/modules/hr/components/leave-lifecycle-actions"
import type { LeaveRequestDetail } from "@/src/modules/hr/data/get-leave-requests"

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

export function LeaveRequestDetailView({
  request,
}: {
  request: LeaveRequestDetail
}) {
  return (
    <PageShell>
      <PageHeader
        title={request.leaveTypeName}
        description={`${request.requestNumber ?? "Leave request"} · ${request.employeeName}`}
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/leave" />}
          >
            <ArrowLeft />
            Back to leave
          </Button>
        }
      />

      <section className="flex flex-wrap items-center gap-3 border-y border-border py-5">
        <Badge variant={statusVariant(request.status)}>
          {label(request.status)}
        </Badge>

        <p className="text-sm text-muted-foreground">
          {formatQuantity(request.requestedQuantity)} working
          day
          {Number(request.requestedQuantity) === 1 ? "" : "s"}
          {" · "}
          {formatDate(request.startDate)} to{" "}
          {formatDate(request.endDate)}
        </p>
      </section>

      <section className="grid gap-8 border-y border-border py-6 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Employee
          </p>
          <p className="mt-1 font-medium">
            {request.employeeName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {request.employeeNumber}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Contract
          </p>
          <p className="mt-1 font-medium">
            {request.contractNumber ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {request.jobTitle}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Submitted
          </p>
          <p className="mt-1 font-medium">
            {request.submittedAt
              ? new Intl.DateTimeFormat("en-TT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(request.submittedAt))
              : "—"}
          </p>
        </div>
      </section>

      {(request.reason || request.employeeComment) && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareText className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Request notes
            </h2>
          </div>

          <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Reason
              </p>
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {request.reason ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Comment for approver
              </p>
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {request.employeeComment ?? "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Day breakdown
          </h2>
        </div>

        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">
                  Working day
                </th>
                <th className="px-3 py-3 text-right font-medium">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {request.days.map((day) => (
                <tr
                  key={day.leaveDate}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-3">
                    {formatDate(day.leaveDate)}
                  </td>
                  <td className="px-3 py-3">
                    {day.isWorkingDay ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatQuantity(day.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CircleCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Approval
          </h2>
        </div>

        <div className="space-y-5 border-y border-border py-6">
          {request.approvalSteps.map((step) => (
            <div
              key={step.id}
              className="flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <p className="font-medium">
                  Step {step.stepNumber}
                  {step.approverName
                    ? ` · ${step.approverName}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.approverPositionTitle ??
                    "Approver position"}
                  {step.approverEmail
                    ? ` · ${step.approverEmail}`
                    : ""}
                </p>
                {step.decisionComment && (
                  <p className="mt-2 text-sm">
                    {step.decisionComment}
                  </p>
                )}
              </div>

              <Badge variant={statusVariant(step.status)}>
                {label(step.status)}
              </Badge>
            </div>
          ))}

          {request.finalDecisionByName && (
            <p className="text-sm text-muted-foreground">
              Final decision by {request.finalDecisionByName}
              {request.finalDecisionComment
                ? ` — ${request.finalDecisionComment}`
                : ""}
            </p>
          )}

          {request.canDecide && (
            <div className="border-t border-border pt-5">
              <LeaveDecisionForm leaveRequestId={request.id} />
            </div>
          )}

          {(request.canWithdraw || request.canCancel) && (
            <LeaveLifecycleActions
              leaveRequestId={request.id}
              canWithdraw={request.canWithdraw}
              canCancel={request.canCancel}
            />
          )}
        </div>
      </section>
    </PageShell>
  )
}
