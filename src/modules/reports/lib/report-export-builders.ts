import { checklistItemLabel } from "@/src/modules/hr/lib/employee-file-checklist";
import type { EmployeeFileCompletenessRow } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import type { MonthlyPayrollReportData } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import type { StatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import type { EmployeePaymentHistoryReportData } from "@/src/modules/payroll/data/get-employee-payment-history";
import type { YearEndEmployeeSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import type { PayrollReadinessData } from "@/src/modules/payroll/lib/payroll-readiness-types";
import { runKindLabel } from "@/src/modules/payroll/lib/payroll-analytics";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import type { ContractExpiryReport } from "@/src/modules/reports/data/get-contract-expiry-report";
import type { EmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
import type { LeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import type { LeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
import type { PayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import type { PaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import type { PayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
import type { PriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
import type { ReportExportTable } from "@/src/modules/reports/lib/report-export-table";

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

function paymentExceptionKindLabel(kind: string): string {
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

function payslipIssueLabel(issue: string): string {
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

function priorEmploymentReasonLabel(reason: string): string {
  switch (reason) {
    case "UNVERIFIED_RECORDS":
      return "Unverified";
    case "INCOMPLETE_PREVIOUS":
      return "Incomplete previous";
    case "UNKNOWN_STATUS_REVIEW":
      return "Unknown status";
    default:
      return reason;
  }
}

export function buildMonthlyPayrollExportTable(
  data: MonthlyPayrollReportData,
): ReportExportTable {
  const periodLabel =
    data.summary.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;

  return {
    title: "Monthly payroll",
    sheetName: "Monthly payroll",
    metadata: [
      { label: "Period", value: periodLabel },
      { label: "Payslips", value: String(data.summary.payslipCount) },
      { label: "Employees", value: String(data.summary.employeeCount) },
    ],
    columns: [
      { header: "Run number", key: "runNumber", width: 14 },
      { header: "Run type", key: "runKind", width: 12 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Gross pay", key: "grossPay", kind: "currency", width: 14 },
      { header: "Net pay", key: "netPay", kind: "currency", width: 14 },
      {
        header: "Employer contributions",
        key: "employerContributions",
        kind: "currency",
        width: 18,
      },
      { header: "Payslips", key: "payslipCount", kind: "integer", width: 10 },
      { header: "Employees", key: "employeeCount", kind: "integer", width: 10 },
      { header: "Posted", key: "postedAt", kind: "date", width: 12 },
    ],
    rows: data.summary.runs.map((run) => ({
      runNumber: run.runNumber,
      runKind: runKindLabel(run.runKind),
      currency: run.currency,
      grossPay: run.grossPay,
      netPay: run.netPay,
      employerContributions: run.employerContributions,
      payslipCount: run.payslipCount,
      employeeCount: run.employeeCount,
      postedAt: run.postedAt?.slice(0, 10) ?? "",
    })),
  };
}

export function buildStatutoryRemittanceExportTable(
  data: StatutoryRemittanceReport,
): ReportExportTable {
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;

  return {
    title: "Statutory remittance",
    sheetName: "Remittance",
    metadata: [
      { label: "Period", value: periodLabel },
      { label: "Posted payslips", value: String(data.payslipCount) },
    ],
    columns: [
      { header: "Currency", key: "currency", width: 10 },
      { header: "PAYE", key: "paye", kind: "currency", width: 14 },
      { header: "NIS (employee)", key: "nisEmployee", kind: "currency", width: 14 },
      { header: "NIS (employer)", key: "nisEmployer", kind: "currency", width: 14 },
      { header: "Health surcharge", key: "health", kind: "currency", width: 14 },
      {
        header: "Total remittance",
        key: "totalRemittance",
        kind: "currency",
        width: 16,
      },
    ],
    rows: data.totalsByCurrency.map((total) => ({
      currency: total.currency,
      paye: total.paye,
      nisEmployee: total.nisEmployee,
      nisEmployer: total.nisEmployer,
      health: total.health,
      totalRemittance: total.totalRemittance,
    })),
  };
}

export function buildEmployeePaymentHistoryExportTable(
  data: EmployeePaymentHistoryReportData,
): ReportExportTable {
  const periodLabel = `${data.period.startPeriodKey} to ${data.period.endPeriodKey}`;

  if (data.scope === "employee" && data.history) {
    const payslipRows = data.history.months.flatMap((month) =>
      month.payslips.map((slip) => ({
        periodKey: month.periodKey,
        periodName: month.periodName,
        employeeNumber: slip.employeeNumber,
        employeeName: slip.employeeName,
        runNumber: slip.runNumber,
        runKind: runKindLabel(slip.runKind),
        currency: slip.currency,
        grossPay: slip.grossPay,
        totalDeductions: slip.totalDeductions,
        netPay: slip.netPay,
        employerContributions: slip.employerContributions,
        postedAt: slip.postedAt?.slice(0, 10) ?? "",
      })),
    );

    return {
      title: "Employee payment history",
      sheetName: "Payment history",
      metadata: [
        {
          label: "Employee",
          value: data.selectedEmployee
            ? `${data.selectedEmployee.displayName} (${data.selectedEmployee.employeeNumber})`
            : "—",
        },
        { label: "Period", value: periodLabel },
        { label: "Preset", value: data.period.preset },
      ],
      columns: [
        { header: "Period", key: "periodName", width: 16 },
        { header: "Run", key: "runNumber", width: 12 },
        { header: "Run type", key: "runKind", width: 12 },
        { header: "Currency", key: "currency", width: 10 },
        { header: "Gross", key: "grossPay", kind: "currency", width: 14 },
        {
          header: "Deductions",
          key: "totalDeductions",
          kind: "currency",
          width: 14,
        },
        { header: "Net", key: "netPay", kind: "currency", width: 14 },
        {
          header: "Employer",
          key: "employerContributions",
          kind: "currency",
          width: 14,
        },
        { header: "Posted", key: "postedAt", kind: "date", width: 12 },
      ],
      rows: payslipRows,
    };
  }

  const roster = data.roster;
  if (!roster) {
    return {
      title: "Employee payment history",
      sheetName: "Payment history",
      metadata: [{ label: "Period", value: periodLabel }],
      columns: [{ header: "Message", key: "message", width: 40 }],
      rows: [{ message: "No posted payments in this period." }],
    };
  }

  const rows = roster.employees.flatMap((employee) =>
    employee.totalsByCurrency.map((total) => ({
      employeeNumber: employee.employeeNumber,
      employeeName: employee.employeeName,
      departmentName: employee.departmentName ?? "",
      currency: total.currency,
      grossPay: total.grossPay,
      totalDeductions: total.totalDeductions,
      netPay: total.netPay,
      employerContributions: total.employerContributions,
      payslipCount: employee.payslipCount,
    })),
  );

  const scopeLabel =
    data.scope === "department"
      ? `Department: ${data.selectedDepartmentName ?? data.selectedDepartmentId ?? "—"}`
      : "All employees";

  return {
    title: "Employee payment history",
    sheetName: "Payment history",
    metadata: [
      { label: "Scope", value: scopeLabel },
      { label: "Period", value: periodLabel },
      { label: "Employees", value: String(roster.employeeCount) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Gross", key: "grossPay", kind: "currency", width: 14 },
      {
        header: "Deductions",
        key: "totalDeductions",
        kind: "currency",
        width: 14,
      },
      { header: "Net", key: "netPay", kind: "currency", width: 14 },
      {
        header: "Employer",
        key: "employerContributions",
        kind: "currency",
        width: 14,
      },
      { header: "Payslips", key: "payslipCount", kind: "integer", width: 10 },
    ],
    rows,
  };
}

export function buildYearEndPayrollExportTable(
  year: number,
  rows: YearEndEmployeeSummary[],
): ReportExportTable {
  return {
    title: "Year-end payroll summaries",
    sheetName: "Year-end",
    metadata: [{ label: "Tax year", value: String(year) }],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Gross", key: "grossPay", kind: "currency", width: 14 },
      { header: "PAYE", key: "paye", kind: "currency", width: 12 },
      { header: "NIS", key: "nisEmployee", kind: "currency", width: 12 },
      { header: "Health", key: "healthSurcharge", kind: "currency", width: 12 },
      {
        header: "Deductions",
        key: "totalDeductions",
        kind: "currency",
        width: 14,
      },
      { header: "Net", key: "netPay", kind: "currency", width: 14 },
    ],
    rows: rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      currency: row.currency,
      grossPay: row.grossPay,
      paye: row.paye,
      nisEmployee: row.nisEmployee,
      healthSurcharge: row.healthSurcharge,
      totalDeductions: row.totalDeductions,
      netPay: row.netPay,
    })),
  };
}

export function buildPayrollReadinessExportTable(
  data: PayrollReadinessData,
): ReportExportTable {
  const notReadyRows = data.rows.filter((row) => !row.isReady);

  return {
    title: "Payroll readiness export",
    sheetName: "Readiness",
    metadata: [
      { label: "Employees", value: String(data.rows.length) },
      { label: "Ready", value: String(data.readyCount) },
      { label: "Not ready", value: String(data.notReadyCount) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "displayName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Category", key: "workforceCategoryLabel", width: 14 },
      { header: "Blocking issues", key: "blockingIssues", width: 36 },
      { header: "Warnings", key: "softWarnings", width: 28 },
    ],
    rows: notReadyRows.map((row) => ({
      employeeNumber: row.employeeNumber,
      displayName: row.displayName,
      departmentName: row.departmentName ?? "",
      workforceCategoryLabel: row.workforceCategoryLabel ?? "",
      blockingIssues: row.blockingIssues.join("; "),
      softWarnings: row.softWarnings.join("; "),
    })),
  };
}

export function buildLeaveBalanceRosterExportTable(
  data: LeaveBalanceRosterReport,
): ReportExportTable {
  return {
    title: "Leave balance roster",
    sheetName: "Leave balances",
    metadata: [
      { label: "Employees", value: String(data.employeeCount) },
      { label: "Balance rows", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "displayName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Leave type", key: "leaveTypeCode", width: 12 },
      { header: "Leave type name", key: "leaveTypeName", width: 18 },
      { header: "Cycle start", key: "cycleStart", kind: "date", width: 12 },
      { header: "Cycle end", key: "cycleEnd", kind: "date", width: 12 },
      { header: "Entitlement", key: "entitlement", kind: "number", width: 12 },
      { header: "Taken", key: "taken", kind: "number", width: 10 },
      { header: "Reserved", key: "reserved", kind: "number", width: 10 },
      { header: "Available", key: "availableBalance", kind: "number", width: 12 },
    ],
    rows: data.rows.map((row) => ({ ...row, departmentName: row.departmentName ?? "" })),
  };
}

export function buildLeaveRegisterExportTable(
  data: LeaveRegisterReport,
): ReportExportTable {
  return {
    title: "Leave register",
    sheetName: "Leave register",
    metadata: [
      { label: "From", value: data.dateFrom },
      { label: "To", value: data.dateTo },
      { label: "Requests", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Request #", key: "requestNumber", width: 14 },
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "displayName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Leave type", key: "leaveTypeCode", width: 12 },
      { header: "Leave type name", key: "leaveTypeName", width: 18 },
      { header: "Paid", key: "paidLabel", width: 10 },
      { header: "Start", key: "startDate", kind: "date", width: 12 },
      { header: "End", key: "endDate", kind: "date", width: 12 },
      { header: "Days", key: "requestedQuantity", kind: "number", width: 10 },
      { header: "Approved", key: "approvedAt", kind: "datetime", width: 18 },
    ],
    rows: data.rows.map((row) => ({
      requestNumber: row.requestNumber ?? "",
      employeeNumber: row.employeeNumber,
      displayName: row.displayName,
      departmentName: row.departmentName ?? "",
      leaveTypeCode: row.leaveTypeCode,
      leaveTypeName: row.leaveTypeName,
      paidLabel: row.isPaid ? "Paid" : "Unpaid",
      startDate: row.startDate,
      endDate: row.endDate,
      requestedQuantity: Number(row.requestedQuantity),
      approvedAt: row.approvedAt ?? "",
    })),
  };
}

export function buildContractExpiryExportTable(
  data: ContractExpiryReport,
): ReportExportTable {
  const windowLabel =
    data.window === "all" ? "All upcoming" : `${data.window} days`;

  return {
    title: "Contract expiry list",
    sheetName: "Contract expiry",
    metadata: [
      { label: "Window", value: windowLabel },
      { label: "Contracts", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Position", key: "positionTitle", width: 20 },
      { header: "Contract #", key: "contractNumber", width: 14 },
      { header: "Type", key: "contractType", width: 14 },
      { header: "End date", key: "endDate", kind: "date", width: 12 },
      { header: "Expiry", key: "expiryLabel", width: 14 },
      { header: "Salary", key: "baseSalary", kind: "number", width: 12 },
      { header: "Currency", key: "currency", width: 10 },
    ],
    rows: data.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      positionTitle: row.positionTitle,
      contractNumber: row.contractNumber ?? "",
      contractType: row.contractType.replaceAll("_", " "),
      endDate: row.endDate ?? "",
      expiryLabel: expiryLabel(row.expiryCategory),
      baseSalary: Number(row.baseSalary),
      currency: row.currency,
    })),
  };
}

export function buildMissingDocumentsExportTable(
  rows: EmployeeFileCompletenessRow[],
): ReportExportTable {
  return {
    title: "Missing employee documents",
    sheetName: "Missing documents",
    metadata: [{ label: "Employees incomplete", value: String(rows.length) }],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "displayName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Complete", key: "completeCount", kind: "integer", width: 10 },
      { header: "Total", key: "totalCount", kind: "integer", width: 10 },
      { header: "Missing items", key: "missingItems", width: 40 },
    ],
    rows: rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      displayName: row.displayName,
      departmentName: row.departmentName ?? "",
      completeCount: row.completeness.completeCount,
      totalCount: row.completeness.totalCount,
      missingItems: row.completeness.missingLabels.join("; "),
    })),
  };
}

export function buildEmployeeNisDetailExportTable(
  data: EmployeeNisDetailReport,
): ReportExportTable {
  return {
    title: "Employee NIS detail",
    sheetName: "NIS detail",
    metadata: [
      { label: "Period", value: data.periodName },
      { label: "Rows", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "NIS #", key: "nisNumber", width: 14 },
      {
        header: "Insurable earnings",
        key: "insurableEarnings",
        kind: "currency",
        width: 16,
      },
      { header: "Class", key: "nisClass", width: 10 },
      { header: "Weeks", key: "contributionWeeks", kind: "integer", width: 8 },
      { header: "EE NIS", key: "nisEmployee", kind: "currency", width: 12 },
      { header: "ER NIS", key: "nisEmployer", kind: "currency", width: 12 },
      { header: "Run", key: "runNumber", width: 12 },
    ],
    rows: data.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName ?? "",
      nisNumber: row.nisNumber ?? "",
      insurableEarnings: row.insurableEarnings,
      nisClass: row.nisClass ?? "",
      contributionWeeks: row.contributionWeeks ?? "",
      nisEmployee: row.nisEmployee,
      nisEmployer: row.nisEmployer,
      runNumber: row.runNumber,
    })),
  };
}

export function buildPriorEmploymentExceptionsExportTable(
  data: PriorEmploymentExceptionsReport,
): ReportExportTable {
  return {
    title: "Prior-employment verification exceptions",
    sheetName: "Prior employment",
    metadata: [
      { label: "Tax year", value: String(data.taxYear) },
      { label: "Exceptions", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "displayName", width: 22 },
      { header: "Department", key: "departmentName", width: 18 },
      { header: "Verified", key: "verifiedCount", kind: "integer", width: 10 },
      { header: "Records", key: "recordCount", kind: "integer", width: 10 },
      { header: "Exceptions", key: "reasons", width: 20 },
      { header: "Detail", key: "detail", width: 36 },
    ],
    rows: data.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      displayName: row.displayName,
      departmentName: row.departmentName ?? "",
      verifiedCount: row.verifiedCount,
      recordCount: row.recordCount,
      reasons: row.reasons.map(priorEmploymentReasonLabel).join(", "),
      detail: row.detail,
    })),
  };
}

export function buildPaymentExceptionsExportTable(
  data: PaymentExceptionsReport,
): ReportExportTable {
  return {
    title: "Payment exceptions",
    sheetName: "Payment exceptions",
    metadata: [{ label: "Exceptions", value: String(data.rows.length) }],
    columns: [
      { header: "Kind", key: "kindLabel", width: 14 },
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Run", key: "runNumber", width: 12 },
      { header: "Bank", key: "bankName", width: 18 },
      { header: "Account", key: "accountMasked", width: 16 },
      { header: "Amount", key: "amount", kind: "currency", width: 14 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Reason", key: "returnReason", width: 24 },
      { header: "When", key: "occurredAt", kind: "datetime", width: 18 },
    ],
    rows: data.rows.map((row) => ({
      kindLabel: paymentExceptionKindLabel(row.kind),
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      runNumber: row.runNumber,
      bankName: row.bankName ?? "",
      accountMasked: row.accountMasked ?? "",
      amount: Number(row.amount),
      currency: row.currency,
      returnReason: row.returnReason ?? "",
      occurredAt: row.occurredAt ?? "",
    })),
  };
}

export function buildPayslipDeliveryExportTable(
  data: PayslipDeliveryReport,
): ReportExportTable {
  return {
    title: "Payslip delivery status",
    sheetName: "Payslip delivery",
    metadata: [
      { label: "Unreleased", value: String(data.summary.unreleased) },
      { label: "Email pending", value: String(data.summary.emailPending) },
      { label: "Email failed", value: String(data.summary.emailFailed) },
    ],
    columns: [
      { header: "Employee #", key: "employeeNumber", width: 12 },
      { header: "Employee", key: "employeeName", width: 22 },
      { header: "Period", key: "periodKey", width: 12 },
      { header: "Run", key: "runNumber", width: 12 },
      { header: "Issue", key: "issueLabel", width: 14 },
      { header: "Email status", key: "emailDeliveryStatus", width: 14 },
      { header: "Posted", key: "postedAt", kind: "datetime", width: 18 },
    ],
    rows: data.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      periodKey: row.periodKey,
      runNumber: row.runNumber,
      issueLabel: payslipIssueLabel(row.issue),
      emailDeliveryStatus: row.emailDeliveryStatus ?? "",
      postedAt: row.postedAt ?? "",
    })),
  };
}

export function buildPayRunApprovalLogExportTable(
  data: PayRunApprovalLogReport,
): ReportExportTable {
  return {
    title: "Pay run approval log",
    sheetName: "Approval log",
    metadata: [
      { label: "From", value: data.dateFrom },
      { label: "To", value: data.dateTo },
      { label: "Pay runs", value: String(data.rows.length) },
    ],
    columns: [
      { header: "Run", key: "runNumber", width: 12 },
      { header: "Run type", key: "runKind", width: 12 },
      { header: "Period", key: "periodName", width: 16 },
      { header: "Period key", key: "periodKey", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Employees", key: "employeeCount", kind: "integer", width: 10 },
      { header: "Gross", key: "totalGrossLabel", width: 16 },
      { header: "Net", key: "totalNetLabel", width: 16 },
      { header: "Approved", key: "approvedAt", kind: "datetime", width: 18 },
      { header: "Approved by", key: "approvedByName", width: 18 },
      { header: "Posted", key: "postedAt", kind: "datetime", width: 18 },
      { header: "Posted by", key: "postedByName", width: 18 },
    ],
    rows: data.rows.map((row) => ({
      runNumber: row.runNumber,
      runKind: runKindLabel(row.runKind as "REGULAR" | "CORRECTION" | "OFF_CYCLE"),
      periodName: row.periodName,
      periodKey: row.periodKey,
      status: row.status,
      employeeCount: row.employeeCount,
      totalGrossLabel: row.totalGrossLabel,
      totalNetLabel: row.totalNetLabel,
      approvedAt: row.approvedAt ?? "",
      approvedByName: row.approvedByName ?? "",
      postedAt: row.postedAt ?? "",
      postedByName: row.postedByName ?? "",
    })),
  };
}

export function buildAuditEventsExportTable(input: {
  headers: string[];
  rows: string[][];
}): ReportExportTable {
  const keys = input.headers.map((header, index) => `col${index}`);

  return {
    title: "Audit trail export",
    sheetName: "Audit events",
    columns: input.headers.map((header, index) => ({
      header,
      key: keys[index]!,
      width: index === 7 ? 40 : 16,
      kind:
        index === 0
          ? "datetime"
          : "text",
    })),
    rows: input.rows.map((row) =>
      Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])),
    ),
  };
}
