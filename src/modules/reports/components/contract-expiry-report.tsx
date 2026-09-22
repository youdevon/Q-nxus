import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatDisplayDate } from "@/src/lib/format";
import type { ContractExpiryReport } from "@/src/modules/reports/data/get-contract-expiry-report";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportLayout,
  ReportPrintLink,
  ReportSummaryGrid,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import {
  ReportTable,
  ReportTableCell,
  ReportTableRow,
} from "@/src/modules/reports/components/report-table";

const WINDOW_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All upcoming" },
] as const;

function windowLabel(window: ContractExpiryReport["window"]): string {
  if (window === "all") {
    return "all upcoming end dates";
  }

  return `the next ${window} days`;
}

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
    case "LATER":
      return "Later";
    default:
      return category;
  }
}

export function ContractExpiryReportView({
  data,
}: {
  data: ContractExpiryReport;
}) {
  const exportHref = `/reports/people/contract-expiry/export?window=${data.window}`;

  return (
    <ReportLayout
      title="Contract expiry list"
      description="Active current employment contracts with end dates. Choose a window to focus on contracts expiring soon."
      actions={
        <PageActionsEnd>
          <ReportPrintLink
            href={reportPrintHref("/reports/people/contract-expiry", {
              window: data.window,
            })}
          />
          <ReportExportLinks href={exportHref} />
        </PageActionsEnd>
      }
      filters={
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Showing contracts ending in{" "}
            <span className="font-medium text-foreground">
              {windowLabel(data.window)}
            </span>
            . Select another window to refresh the list.
          </p>
          <div className="flex flex-wrap gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                nativeButton={false}
                variant={data.window === option.value ? "default" : "outline"}
                size="sm"
                render={
                  <Link
                    href={`/reports/people/contract-expiry?window=${option.value}`}
                  />
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <ReportSummaryGrid
        items={[
          {
            label: "With end date",
            value: data.summary.totalWithEndDate,
          },
          {
            label: "Within 30 days",
            value: data.summary.within30Days,
          },
          {
            label: "Within 90 days",
            value: data.summary.within90Days,
          },
          { label: "Expired", value: data.summary.expired },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportEmptyState
          message={`No current contracts with end dates in ${windowLabel(data.window)}.`}
          hint={
            data.summary.totalWithEndDate > 0
              ? `${data.summary.totalWithEndDate} contract${data.summary.totalWithEndDate === 1 ? "" : "s"} have end dates outside this window — try “All upcoming”.`
              : "No active or recently expired contracts with end dates were found."
          }
        />
      ) : (
        <ReportTable
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
            <ReportTableRow key={row.id}>
              <ReportTableCell>
                <Link
                  href={`/people/employees/${row.employeeId}/contracts`}
                  className="font-medium hover:underline"
                >
                  {row.employeeName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.positionTitle}</ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.contractNumber ?? "—"}
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.contractType.replaceAll("_", " ")}
              </ReportTableCell>
              <ReportTableCell>
                {formatDisplayDate(row.endDate, { fallback: "—" })}
              </ReportTableCell>
              <ReportTableCell>
                <Badge
                  variant={
                    row.expiryCategory === "EXPIRED" ||
                    row.expiryCategory === "WITHIN_30_DAYS"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {expiryLabel(row.expiryCategory)}
                </Badge>
              </ReportTableCell>
              <ReportTableCell className="tabular-nums text-xs">
                {row.baseSalary} {row.currency}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
