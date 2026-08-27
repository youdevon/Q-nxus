import { Badge } from "@/components/ui/badge";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import type { PaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportLayout,
  ReportPrintLink,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import {
  ReportTable,
  ReportTableCell,
  ReportTableRow,
} from "@/src/modules/reports/components/report-table";

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

export function PaymentExceptionsReportView({
  data,
}: {
  data: PaymentExceptionsReport;
}) {
  return (
    <ReportLayout
      title="Payment exceptions"
      description="Failed, returned, or rejected bank allocations and paid rows awaiting reconciliation."
      actions={
        <PageActionsEnd>
          <ReportPrintLink href={reportPrintHref("/reports/payroll/payment-exceptions")} />
          <ReportExportLinks href="/reports/payroll/payment-exceptions/export" />
        </PageActionsEnd>
      }
    >
      {data.rows.length === 0 ? (
        <ReportEmptyState message="No payment exceptions on record." />
      ) : (
        <ReportTable
          headers={[
            "Kind",
            "Employee",
            "Run",
            "Bank / account",
            "Amount",
            "Reason",
            "When",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={`${row.kind}-${row.id}`}>
              <ReportTableCell>
                <Badge variant="warning">{kindLabel(row.kind)}</Badge>
              </ReportTableCell>
              <ReportTableCell>
                <div className="font-medium">{row.employeeName}</div>
                <div className="text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.runNumber}</ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.bankName ?? "—"}
                {row.accountMasked ? (
                  <div className="text-muted-foreground">{row.accountMasked}</div>
                ) : null}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {formatMoney(Number(row.amount), { currency: row.currency })}
              </ReportTableCell>
              <ReportTableCell className="text-sm">
                {row.returnReason ?? "—"}
              </ReportTableCell>
              <ReportTableCell className="text-xs text-muted-foreground">
                {formatDisplayDate(row.occurredAt, { fallback: "—" })}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
