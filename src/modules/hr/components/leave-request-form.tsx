"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import {
  createLeaveRequest,
  type LeaveRequestFormState,
} from "@/src/modules/hr/actions/create-leave-request"
import type { NewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data"

const initialState: LeaveRequestFormState = {
  status: "idle",
  message: "",
}

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function countWorkingDays(
  startValue: string,
  endValue: string,
): number {
  if (!startValue || !endValue) {
    return 0
  }

  const start = new Date(`${startValue}T00:00:00.000Z`)
  const end = new Date(`${endValue}T00:00:00.000Z`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0
  }

  let total = 0
  const cursor = new Date(start)

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay()

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      total += 1
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return total
}

export function LeaveRequestForm({
  data,
}: {
  data: NewLeaveRequestData
}) {
  const [state, action, pending] = useActionState(
    createLeaveRequest,
    initialState,
  )

  const [leaveBalanceId, setLeaveBalanceId] = useState(
    data.balances[0]?.id ?? "",
  )
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const selectedBalance = data.balances.find(
    (balance) => balance.id === leaveBalanceId,
  )

  const workingDays = useMemo(
    () => countWorkingDays(startDate, endDate),
    [startDate, endDate],
  )

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form action={action}>
      <PageShell>
      <PageHeader
        title="Request Leave"
        description={`${data.user.employeeName} · ${data.user.employeeNumber}`}
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/leave" />}
            >
              <ArrowLeft />
              Back to leave
            </Button>

            <Button
              type="submit"
              disabled={
                pending ||
                data.balances.length === 0 ||
                !data.supervisor.canApprove
              }
            >
              <Send />
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      />

      {!data.supervisor.canApprove && (
        <div className="border-y border-amber-500/40 bg-amber-500/5 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">Approver not ready</p>
          <p className="mt-1 text-xs opacity-90">
            {data.supervisor.issueMessage}
          </p>
          {data.supervisor.employeeName && (
            <p className="mt-2 text-xs">
              Reporting line: {data.supervisor.employeeName}
              {data.supervisor.positionTitle
                ? ` · ${data.supervisor.positionTitle}`
                : ""}
            </p>
          )}
        </div>
      )}

      {data.supervisor.canApprove &&
        data.supervisor.employeeName && (
          <div className="border-y border-border py-3 text-sm text-muted-foreground">
            Approver: {data.supervisor.employeeName}
            {data.supervisor.positionTitle
              ? ` · ${data.supervisor.positionTitle}`
              : ""}
          </div>
        )}

      {state.status === "error" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {data.balances.length === 0 ? (
        <div className="border-y border-border py-12 text-center">
          <p className="text-sm font-medium">
            No leave balances available
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {!data.currentContract
              ? "Create a current employment contract first."
              : !data.currentContract.hasEndDate
                ? "Your current contract needs an end date before leave balances can be generated. Amend the contract and set an end date."
                : "Leave entitlement rules may be missing, or balances could not be generated for this contract. Check Leave Types and entitlement rules under People."}
          </p>
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="leaveTypeId"
            value={selectedBalance?.leaveTypeId ?? ""}
          />
          <input
            type="hidden"
            name="contractId"
            value={selectedBalance?.contractId ?? ""}
          />

          <section>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Leave details
              </h2>
            </div>

            <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label
                  htmlFor="leaveBalanceId"
                  className="text-sm font-medium"
                >
                  Leave type
                </label>

                <select
                  id="leaveBalanceId"
                  value={leaveBalanceId}
                  onChange={(event) =>
                    setLeaveBalanceId(event.target.value)
                  }
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {data.balances.map((balance) => (
                    <option key={balance.id} value={balance.id}>
                      {balance.leaveTypeName} ·{" "}
                      {formatQuantity(balance.availableBalance)}{" "}
                      available · {balance.contractNumber ??
                        balance.jobTitle}
                    </option>
                  ))}
                </select>

                {state.fieldErrors?.leaveTypeId && (
                  <p className="mt-1 text-xs text-destructive">
                    {state.fieldErrors.leaveTypeId}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className="text-sm font-medium"
                >
                  Start date
                </label>

                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                  className="mt-2"
                  required
                />

                {state.fieldErrors?.startDate && (
                  <p className="mt-1 text-xs text-destructive">
                    {state.fieldErrors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="text-sm font-medium"
                >
                  End date
                </label>

                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                  className="mt-2"
                  required
                />

                {state.fieldErrors?.endDate && (
                  <p className="mt-1 text-xs text-destructive">
                    {state.fieldErrors.endDate}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">
                  Working days
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {workingDays}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weekends are excluded automatically.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">
                  Available balance
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedBalance
                    ? formatQuantity(
                        selectedBalance.availableBalance,
                      )
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedBalance
                    ? `${selectedBalance.leaveTypeCode} · cycle ${selectedBalance.cycleStart.slice(0, 10)} to ${selectedBalance.cycleEnd.slice(0, 10)}`
                    : "Select a leave type"}
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="reason"
                  className="text-sm font-medium"
                >
                  Reason
                </label>

                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  className="mt-2"
                  placeholder="Optional reason for the absence"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="employeeComment"
                  className="text-sm font-medium"
                >
                  Comment for approver
                </label>

                <Textarea
                  id="employeeComment"
                  name="employeeComment"
                  rows={3}
                  className="mt-2"
                  placeholder="Optional note for your supervisor"
                />
              </div>
            </div>
          </section>
        </>
      )}
      </PageShell>
    </form>
  )
}
