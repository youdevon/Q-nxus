import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileClock,
  FileWarning,
  Landmark,
  ListChecks,
  Palmtree,
  Receipt,
  ScrollText,
  Send,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";

import type { UserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { PAYROLL_VIEW_CAPABILITIES } from "@/src/modules/auth/lib/capability-check";
import {
  PAYROLL_PRIOR_EMPLOYMENT_VERIFY_CAPABILITIES,
} from "@/src/modules/payroll/data/require-payroll-access";

export type ReportCategoryId = "payroll" | "people" | "administration";

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  href: string;
  category: ReportCategoryId;
  icon: LucideIcon;
  /** Any of these permissions grants access (plus reports.view). */
  permissions: readonly string[];
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategoryId, string> = {
  payroll: "Payroll",
  people: "People & HR",
  administration: "Administration",
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "monthly-payroll",
    title: "Monthly payroll",
    description:
      "Gross, deductions, net, employer contributions, and total payroll cost from posted payslips for a selected month.",
    href: "/payroll/reports/monthly",
    category: "payroll",
    icon: CalendarRange,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "statutory-remittance",
    title: "Statutory remittance",
    description:
      "PAYE, NIS (employee + employer), and Health Surcharge due for a month — summed from posted payslips.",
    href: "/payroll/reports/remittance",
    category: "payroll",
    icon: Landmark,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "employee-payment-history",
    title: "Employee payment history",
    description:
      "Posted payment totals by employee, department, or period — including corrections and off-cycle runs.",
    href: "/payroll/reports/employee",
    category: "payroll",
    icon: UserRound,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "year-end",
    title: "Year-end summaries",
    description:
      "Annual gross, PAYE, NIS, Health Surcharge, deductions, and net totals for TD4 preparation.",
    href: "/payroll/reports/year-end",
    category: "payroll",
    icon: CalendarDays,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "payroll-readiness",
    title: "Payroll readiness export",
    description:
      "Org-wide list of employees who cannot be paid and why — blocking issues from payroll readiness checks.",
    href: "/reports/payroll/readiness",
    category: "payroll",
    icon: Wallet,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "employee-nis-detail",
    title: "Employee NIS detail (monthly)",
    description:
      "Per employee for a selected month: NIS number, insurable earnings, class, contribution weeks, and EE/ER amounts from posted payslips.",
    href: "/reports/payroll/nis-detail",
    category: "payroll",
    icon: Receipt,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "prior-employment-exceptions",
    title: "Prior-employment verification exceptions",
    description:
      "Employees with unverified or missing prior-employer YTD for the current tax year.",
    href: "/reports/payroll/prior-employment-exceptions",
    category: "payroll",
    icon: AlertTriangle,
    permissions: PAYROLL_PRIOR_EMPLOYMENT_VERIFY_CAPABILITIES,
  },
  {
    id: "payment-exceptions",
    title: "Payment exceptions",
    description:
      "Failed, returned, or rejected bank payment allocations and unreconciled payment rows.",
    href: "/reports/payroll/payment-exceptions",
    category: "payroll",
    icon: AlertTriangle,
    permissions: ["payroll.manage"],
  },
  {
    id: "payslip-delivery",
    title: "Payslip delivery status",
    description:
      "Posted payslips that are unreleased, unsent, or failed email delivery after release.",
    href: "/reports/payroll/payslip-delivery",
    category: "payroll",
    icon: Send,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "pay-run-approval-log",
    title: "Pay run approval log",
    description:
      "Pay runs approved or posted in a period — reviewer, dates, employee count, and totals.",
    href: "/reports/payroll/pay-run-approval-log",
    category: "payroll",
    icon: ScrollText,
    permissions: PAYROLL_VIEW_CAPABILITIES,
  },
  {
    id: "leave-balances",
    title: "Leave balance roster",
    description:
      "Org-wide leave balances by type for all active employees on current contracts.",
    href: "/reports/people/leave-balances",
    category: "people",
    icon: Palmtree,
    permissions: ["leave.manage", "people.manage", "leave.approve"],
  },
  {
    id: "leave-register",
    title: "Leave register",
    description:
      "Approved leave in a date range — employee, type, dates, quantity, and paid vs unpaid.",
    href: "/reports/people/leave-register",
    category: "people",
    icon: ListChecks,
    permissions: ["leave.manage", "people.manage", "leave.approve"],
  },
  {
    id: "contract-expiry",
    title: "Contract expiry list",
    description:
      "Current employment contracts with end dates — filter by 30, 60, 90 days, or all upcoming.",
    href: "/reports/people/contract-expiry",
    category: "people",
    icon: CalendarDays,
    permissions: ["contracts.view", "contracts.manage", "people.manage"],
  },
  {
    id: "missing-documents",
    title: "Missing employee documents",
    description:
      "Org-wide employee file checklist gaps — incomplete required documents.",
    href: "/reports/people/missing-documents",
    category: "people",
    icon: FileWarning,
    permissions: ["people.manage"],
  },
  {
    id: "audit-export",
    title: "Audit trail export",
    description:
      "Filterable audit event log with CSV download for compliance review.",
    href: "/administration/audit",
    category: "administration",
    icon: FileClock,
    permissions: ["administration.view"],
  },
];

export function canAccessReport(
  capabilities: UserCapabilities,
  permissions: readonly string[],
): boolean {
  return capabilities.canAny("reports.view", ...permissions);
}

export function filterReportsForCapabilities(
  capabilities: UserCapabilities,
): ReportDefinition[] {
  return REPORT_DEFINITIONS.filter((report) =>
    canAccessReport(capabilities, report.permissions),
  );
}

export function reportsByCategory(
  reports: ReportDefinition[],
): Record<ReportCategoryId, ReportDefinition[]> {
  const grouped: Record<ReportCategoryId, ReportDefinition[]> = {
    payroll: [],
    people: [],
    administration: [],
  };

  for (const report of reports) {
    grouped[report.category].push(report);
  }

  return grouped;
}

export function findReportDefinition(id: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((report) => report.id === id);
}

/** Icons used by the hub header only. */
export const REPORTS_HUB_ICON = ClipboardList;
export const REPORTS_HUB_ADMIN_ICON = ShieldCheck;
