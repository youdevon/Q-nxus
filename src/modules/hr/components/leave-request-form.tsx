"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarDays, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createLeaveRequest,
  type LeaveRequestFormState,
} from "@/src/modules/hr/actions/create-leave-request";
import type { NewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { countWorkingDaysInclusive } from "@/src/modules/hr/lib/leave-day-math";

const initialState: LeaveRequestFormState = {
  status: "idle",
  message: "",
};

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function LeaveRequestForm({ data }: { data: NewLeaveRequestData }) {
  const isOnBehalf = data.mode === "onBehalf";
  const backHref = isOnBehalf ? "/people/leave" : "/me/leave";
  const backLabel = isOnBehalf ? "Leave" : "My leave";
  const cancelHref = backHref;
  const [state, action, pending] = useActionState(
    createLeaveRequest,
    initialState,
  );

  const [leaveBalanceId, setLeaveBalanceId] = useState(
    data.balances[0]?.id ?? "",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [historicalRecord, setHistoricalRecord] = useState(false);

  const selectedBalance = data.balances.find(
    (balance) => balance.id === leaveBalanceId,
  );

  const workingDays = useMemo(
    () => countWorkingDaysInclusive(startDate, endDate, data.holidayDates),
    [startDate, endDate, data.holidayDates],
  );

  const documentRequired = Boolean(
    !historicalRecord &&
      selectedBalance?.requiresDocument &&
      (selectedBalance.documentRequiredAfter == null ||
        workingDays >= Number(selectedBalance.documentRequiredAfter)),
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const canSubmit =
    data.balances.length > 0 &&
    (historicalRecord || data.supervisor.canApprove);

  const headerTitle = isOnBehalf
    ? "Request leave for an employee"
    : "Request leave";
  const headerDescription = isOnBehalf
    ? `On behalf of ${data.employee.employeeName} · ${data.employee.employeeNumber}`
    : `${data.employee.employeeName} · ${data.employee.employeeNumber}`;
  const headerActions = (
    <FormPageActions cancelHref={cancelHref}>
      <Button type="submit" disabled={pending || !canSubmit}>
        <Send />
        {pending
          ? historicalRecord
            ? "Recording…"
            : "Submitting…"
          : historicalRecord
            ? "Record past leave"
            : "Submit request"}
      </Button>
    </FormPageActions>
  );

  return (
    <form action={action}>
      <input type="hidden" name="mode" value={data.mode} />
      <input type="hidden" name="employeeId" value={data.employee.id} />

      <PageShell>
        {isOnBehalf ? (
          <PeoplePageHeader
            title={headerTitle}
            description={headerDescription}
            backHref={backHref}
            backLabel={backLabel}
            actions={headerActions}
          />
        ) : (
          <MePageHeader
            title={headerTitle}
            description={headerDescription}
            backHref={backHref}
            backLabel={backLabel}
            actions={headerActions}
          />
        )}

        {isOnBehalf ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/people/leave/new"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Change employee
            </Link>
          </p>
        ) : null}

        {!data.supervisor.canApprove && !historicalRecord && (
          <div className="border-y border-amber-500/40 bg-amber-500/5 py-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium">Approver not ready</p>
            <p className="mt-1 text-sm opacity-90">
              {data.supervisor.issueMessage}
            </p>
            {data.supervisor.employeeName && (
              <p className="mt-2 text-sm">
                Reporting line: {data.supervisor.employeeName}
                {data.supervisor.positionTitle
                  ? ` · ${data.supervisor.positionTitle}`
                  : ""}
              </p>
            )}
          </div>
        )}

        {data.supervisor.canApprove && data.supervisor.employeeName && (
          <div className="text-sm text-muted-foreground">
            Approver: {data.supervisor.employeeName}
            {data.supervisor.positionTitle
              ? ` · ${data.supervisor.positionTitle}`
              : ""}
          </div>
        )}

        {state.status === "error" && (
          <div className="border-y border-destructive/40 bg-destructive/5 py-4 text-sm text-destructive">
            {state.message}
          </div>
        )}

        {data.balances.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">No leave balances available</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!data.currentContract
                ? isOnBehalf
                  ? "This employee needs a current employment contract first."
                  : "Create a current employment contract first."
                : !data.currentContract.hasEndDate
                  ? isOnBehalf
                    ? "This employee’s current contract needs an end date before leave balances can be generated."
                    : "Your current contract needs an end date before leave balances can be generated. Amend the contract and set an end date."
                  : isOnBehalf
                    ? "Leave entitlement rules may be missing, or balances could not be generated for this contract."
                    : "Leave entitlement rules may be missing, or balances could not be generated for this contract. Check the employment contract and its leave entitlement setup."}
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

              <div className="grid gap-5 md:grid-cols-2">
                {isOnBehalf ? (
                  <label className="md:col-span-2 flex items-start gap-3 rounded-md border border-border p-3">
                    <input
                      type="checkbox"
                      name="historicalRecord"
                      checked={historicalRecord}
                      onChange={(event) =>
                        setHistoricalRecord(event.target.checked)
                      }
                      className="mt-0.5 size-4"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        Record as past approved leave
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        For paper cutover: skips notice and approval, posts the
                        days as already taken, and requires an end date before
                        today.
                      </span>
                    </span>
                  </label>
                ) : null}

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
                    onChange={(event) => setLeaveBalanceId(event.target.value)}
                    className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                    required
                  >
                    {data.balances.map((balance) => (
                      <option key={balance.id} value={balance.id}>
                        {balance.leaveTypeName} (
                        {formatQuantity(balance.availableBalance)}
                        {" "}
                        available)
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
                  <label htmlFor="startDate" className="text-sm font-medium">
                    Start date
                  </label>

                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
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
                  <label htmlFor="endDate" className="text-sm font-medium">
                    End date
                  </label>

                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
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
                  <p className="text-sm font-medium">Working days</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {workingDays}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Weekends and org holidays excluded
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Available balance</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {selectedBalance
                      ? formatQuantity(selectedBalance.availableBalance)
                      : "—"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedBalance
                      ? selectedBalance.leaveTypeCode
                      : "Select a leave type"}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="attachment" className="text-sm font-medium">
                    Supporting document
                    {documentRequired ? " (required)" : " (optional)"}
                  </label>
                  <Input
                    id="attachment"
                    name="attachment"
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    className="mt-2"
                    required={documentRequired}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, Word, or image up to 15 MB.
                  </p>
                  {state.fieldErrors?.attachment && (
                    <p className="mt-1 text-xs text-destructive">
                      {state.fieldErrors.attachment}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="reason" className="text-sm font-medium">
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
                    placeholder={
                      isOnBehalf
                        ? "Optional note for the approver"
                        : "Optional note for your supervisor"
                    }
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </PageShell>
    </form>
  );
}
