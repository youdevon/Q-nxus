import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import type { EmployeeFileCompletenessRow } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import type { PayrollReadinessData } from "@/src/modules/payroll/lib/payroll-readiness-types";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { runKindLabel, type PayRunKindAnalytics } from "@/src/modules/payroll/lib/payroll-analytics";
import type { ContractExpiryReport } from "@/src/modules/reports/data/get-contract-expiry-report";
import type { EmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
import type { LeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import type { LeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
import type { PayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import type { PaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import type { PayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
import type { PriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
import {
  ReportPrintEmptyState,
  ReportPrintMuted,
  ReportPrintSection,
  ReportPrintSummaryGrid,
  ReportPrintTable,
  ReportPrintTableCell,
  ReportPrintTableRow,
} from "@/src/modules/reports/components/report-print-table";

function expiryLabel(category: string): string {
  switch (category) {
    case "EXPIRED":
      return "Expired";
    case "WITHIN_30_DAYS":
      return "≤ 30 days";
    case "WITHIN_60_DAYS":
      return "≤ 60 days";
    case "WITHIN_90_DAYS":
      return "≤ 90 days";
    default:
      return category;
  }
}

function issueLabel(issue: string): string {
  switch (issue) {
    case "UNRELEASED":
      return "Unreleased";
    case "EMAIL_PENDING":
      return "Email pending";
    case "EMAIL_FAILED":
      return "Email failed";
    default:
      return issue;
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "ALLOCATION_RETURNED":
      return "Returned";
    case "ALLOCATION_REJECTED":
      return "Rejected";
    case "ALLOCATION_FAILED":
      return "Failed";
    case "PAYMENT_UNRECONCILED":
      return "Unreconciled";
    default:
      return kind;
  }
}

export function PayrollReadinessPrintContent({
  data,
}: {
  data: PayrollReadinessData;
}) {
  const notReadyRows = data.rows.filter((row) => !row.isReady);

  return (
    <>
      <ReportPrintSummaryGrid
        items={[
          { label: "Employees", value: data.rows.length },
          { label: "Ready", value: data.readyCount },
          { label: "Not ready", value: data.notReadyCount },
        ]}
      />

      {notReadyRows.length === 0 ? (
        <ReportPrintEmptyState message="All active employees are payroll-ready." />
      ) : (
        <ReportPrintTable
          headers={[
            "Employee",
            "Department",
            "Category",
            "Blocking issues",
            "Warnings",
          ]}
        >
          {notReadyRows.map((row) => (
            <ReportPrintTableRow key={row.employeeId}>
              <ReportPrintTableCell>
                <div>{row.displayName}</div>
                <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.departmentName ?? "—"}</ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.workforceCategoryLabel ?? "—"}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.blockingIssues.join("; ")}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.softWarnings.length === 0
                  ? "—"
                  : row.softWarnings.join("; ")}
              </ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
        </ReportPrintTable>
      )}
    </>
  );
}

export function EmployeeNisDetailPrintContent({
  data,
}: {
  data: EmployeeNisDetailReport;
}) {
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;

  if (data.rows.length === 0) {
    return (
      <ReportPrintEmptyState
        message={`No posted payslips for ${periodLabel}.`}
      />
    );
  }

  return (
    <ReportPrintTable
      headers={[
        "Employee",
        "NIS #",
        "Insurable earnings",
        "Class",
        "Weeks",
        "EE NIS",
        "ER NIS",
        "Run",
      ]}
      alignRightFrom={2}
    >
      {data.rows.map((row) => (
        <ReportPrintTableRow key={row.payslipId}>
          <ReportPrintTableCell>
            <div>{row.employeeName}</div>
            <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.nisNumber ?? "—"}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.insurableEarnings, { currency: row.currency })}
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.nisClass ?? "—"}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {row.contributionWeeks ?? "—"}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.nisEmployee, { currency: row.currency })}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.nisEmployer, { currency: row.currency })}
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.runNumber}</ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}

export function PriorEmploymentExceptionsPrintContent({
  data,
}: {
  data: PriorEmploymentExceptionsReport;
}) {
  return (
    <>
      <ReportPrintSummaryGrid
        items={[
          { label: "Tax year", value: data.taxYear },
          { label: "Exceptions", value: data.rows.length },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportPrintEmptyState message="No prior-employment verification exceptions." />
      ) : (
        <ReportPrintTable
          headers={[
            "Employee",
            "Department",
            "Records",
            "Exception",
            "Detail",
          ]}
        >
          {data.rows.map((row) => (
            <ReportPrintTableRow key={row.employeeId}>
              <ReportPrintTableCell>
                <div>{row.displayName}</div>
                <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.departmentName ?? "—"}</ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {row.verifiedCount} / {row.recordCount}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.reasons
                  .map((reason) =>
                    reason === "UNVERIFIED_RECORDS"
                      ? "Unverified"
                      : reason === "INCOMPLETE_PREVIOUS"
                        ? "Incomplete"
                        : "Unknown status",
                  )
                  .join(", ")}
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.detail}</ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
        </ReportPrintTable>
      )}
    </>
  );
}

export function PaymentExceptionsPrintContent({
  data,
}: {
  data: PaymentExceptionsReport;
}) {
  if (data.rows.length === 0) {
    return <ReportPrintEmptyState message="No payment exceptions on record." />;
  }

  return (
    <ReportPrintTable
      headers={[
        "Kind",
        "Employee",
        "Run",
        "Bank / account",
        "Amount",
        "Reason",
        "When",
      ]}
      alignRightFrom={4}
    >
      {data.rows.map((row) => (
        <ReportPrintTableRow key={`${row.kind}-${row.id}`}>
          <ReportPrintTableCell>{kindLabel(row.kind)}</ReportPrintTableCell>
          <ReportPrintTableCell>
            <div>{row.employeeName}</div>
            <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.runNumber}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {row.bankName ?? "—"}
            {row.accountMasked ? (
              <div className="text-xs text-neutral-500">{row.accountMasked}</div>
            ) : null}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(Number(row.amount), { currency: row.currency })}
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.returnReason ?? "—"}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {formatDisplayDate(row.occurredAt, { fallback: "—" })}
          </ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}

export function PayslipDeliveryPrintContent({
  data,
}: {
  data: PayslipDeliveryReport;
}) {
  return (
    <>
      <ReportPrintSummaryGrid
        items={[
          { label: "Unreleased", value: data.summary.unreleased },
          { label: "Email pending", value: data.summary.emailPending },
          { label: "Email failed", value: data.summary.emailFailed },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportPrintEmptyState message="All posted payslips are released and delivered." />
      ) : (
        <ReportPrintTable
          headers={[
            "Employee",
            "Period",
            "Run",
            "Issue",
            "Email status",
            "Posted",
          ]}
        >
          {data.rows.map((row) => (
            <ReportPrintTableRow key={row.payslipId}>
              <ReportPrintTableCell>
                <div>{row.employeeName}</div>
                <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.periodKey}</ReportPrintTableCell>
              <ReportPrintTableCell>{row.runNumber}</ReportPrintTableCell>
              <ReportPrintTableCell>{issueLabel(row.issue)}</ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.emailDeliveryStatus ?? "—"}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {formatDisplayDate(row.postedAt, { fallback: "—" })}
              </ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
        </ReportPrintTable>
      )}
    </>
  );
}

export function PayRunApprovalLogPrintContent({
  data,
}: {
  data: PayRunApprovalLogReport;
}) {
  if (data.rows.length === 0) {
    return (
      <ReportPrintEmptyState message="No pay runs approved or posted in this period." />
    );
  }

  return (
    <ReportPrintTable
      headers={[
        "Run",
        "Period",
        "Status",
        "Employees",
        "Gross",
        "Net",
        "Approved",
        "Posted",
      ]}
      alignRightFrom={3}
    >
      {data.rows.map((row) => (
        <ReportPrintTableRow key={row.id}>
          <ReportPrintTableCell>
            <div>{row.runNumber}</div>
            <ReportPrintMuted>
              {runKindLabel(row.runKind)}
            </ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>
            <div>{row.periodName}</div>
            <ReportPrintMuted>{row.periodKey}</ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.status}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">{row.employeeCount}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">{row.totalGrossLabel}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">{row.totalNetLabel}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {formatDisplayDate(row.approvedAt, { fallback: "—" })}
            {row.approvedByName ? (
              <div className="text-xs text-neutral-500">{row.approvedByName}</div>
            ) : null}
          </ReportPrintTableCell>
          <ReportPrintTableCell>
            {formatDisplayDate(row.postedAt, { fallback: "—" })}
            {row.postedByName ? (
              <div className="text-xs text-neutral-500">{row.postedByName}</div>
            ) : null}
          </ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}

export function LeaveBalanceRosterPrintContent({
  data,
}: {
  data: LeaveBalanceRosterReport;
}) {
  return (
    <>
      <ReportPrintSummaryGrid
        items={[
          { label: "Employees", value: data.employeeCount },
          { label: "Balance rows", value: data.rows.length },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportPrintEmptyState message="No leave balances found for active employees." />
      ) : (
        <ReportPrintTable
          headers={[
            "Employee",
            "Department",
            "Leave type",
            "Cycle",
            "Entitlement",
            "Taken",
            "Reserved",
            "Available",
          ]}
          alignRightFrom={4}
        >
          {data.rows.map((row) => (
            <ReportPrintTableRow
              key={`${row.employeeId}-${row.leaveTypeCode}-${row.cycleStart}`}
            >
              <ReportPrintTableCell>
                <div>{row.displayName}</div>
                <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.departmentName ?? "—"}</ReportPrintTableCell>
              <ReportPrintTableCell>
                <div>{row.leaveTypeCode}</div>
                <ReportPrintMuted>{row.leaveTypeName}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.cycleStart} → {row.cycleEnd}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">{row.entitlement}</ReportPrintTableCell>
              <ReportPrintTableCell align="right">{row.taken}</ReportPrintTableCell>
              <ReportPrintTableCell align="right">{row.reserved}</ReportPrintTableCell>
              <ReportPrintTableCell align="right">{row.availableBalance}</ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
        </ReportPrintTable>
      )}
    </>
  );
}

export function LeaveRegisterPrintContent({
  data,
}: {
  data: LeaveRegisterReport;
}) {
  if (data.rows.length === 0) {
    return <ReportPrintEmptyState message="No approved leave in this period." />;
  }

  return (
    <ReportPrintTable
      headers={[
        "Employee",
        "Leave type",
        "Paid",
        "Dates",
        "Days",
        "Approved",
      ]}
    >
      {data.rows.map((row) => (
        <ReportPrintTableRow key={row.id}>
          <ReportPrintTableCell>
            <div>{row.displayName}</div>
            <ReportPrintMuted>
              {row.employeeNumber}
              {row.requestNumber ? ` · ${row.requestNumber}` : ""}
            </ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>
            <div>{row.leaveTypeCode}</div>
            <ReportPrintMuted>{row.leaveTypeName}</ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.isPaid ? "Paid" : "Unpaid"}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {row.startDate} → {row.endDate}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">{row.requestedQuantity}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {formatDisplayDate(row.approvedAt, { fallback: "—" })}
          </ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}

export function ContractExpiryPrintContent({
  data,
}: {
  data: ContractExpiryReport;
}) {
  if (data.rows.length === 0) {
    return (
      <ReportPrintEmptyState message="No current contracts with end dates in this expiry window." />
    );
  }

  return (
    <ReportPrintTable
      headers={[
        "Employee",
        "Position",
        "Contract",
        "Type",
        "End date",
        "Expiry",
        "Salary",
      ]}
    >
      {data.rows.map((row) => (
        <ReportPrintTableRow key={row.id}>
          <ReportPrintTableCell>
            <div>{row.employeeName}</div>
            <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell>{row.positionTitle}</ReportPrintTableCell>
          <ReportPrintTableCell>{row.contractNumber ?? "—"}</ReportPrintTableCell>
          <ReportPrintTableCell>
            {row.contractType.replaceAll("_", " ")}
          </ReportPrintTableCell>
          <ReportPrintTableCell>
            {formatDisplayDate(row.endDate, { fallback: "—" })}
          </ReportPrintTableCell>
          <ReportPrintTableCell>{expiryLabel(row.expiryCategory)}</ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {row.baseSalary} {row.currency}
          </ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}

export function MissingDocumentsPrintContent({
  rows,
}: {
  rows: EmployeeFileCompletenessRow[];
}) {
  return (
    <>
      <ReportPrintSummaryGrid
        items={[{ label: "Employees incomplete", value: rows.length }]}
      />

      {rows.length === 0 ? (
        <ReportPrintEmptyState message="All employee files are complete." />
      ) : (
        <ReportPrintTable
          headers={["Employee", "Department", "Progress", "Missing items"]}
        >
          {rows.map((row) => (
            <ReportPrintTableRow key={row.employeeId}>
              <ReportPrintTableCell>
                <div>{row.displayName}</div>
                <ReportPrintMuted>{row.employeeNumber}</ReportPrintMuted>
              </ReportPrintTableCell>
              <ReportPrintTableCell>{row.departmentName ?? "—"}</ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {row.completeness.completeCount} / {row.completeness.totalCount}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.completeness.missingLabels.join(", ")}
              </ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
        </ReportPrintTable>
      )}
    </>
  );
}

export function nisDetailMetaLines(data: EmployeeNisDetailReport): string[] {
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;
  return [`Period: ${periodLabel}`];
}

export function leaveRegisterMetaLines(data: LeaveRegisterReport): string[] {
  return [`${data.dateFrom} to ${data.dateTo}`];
}

export function payRunApprovalLogMetaLines(
  data: PayRunApprovalLogReport,
): string[] {
  return [`${data.dateFrom} to ${data.dateTo}`];
}

export function contractExpiryMetaLines(data: ContractExpiryReport): string[] {
  const windowLabel =
    data.window === "all"
      ? "All upcoming"
      : `${data.window}-day window`;
  return [`Expiry window: ${windowLabel}`];
}
