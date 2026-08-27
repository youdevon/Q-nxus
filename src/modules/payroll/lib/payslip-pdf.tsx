import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatMoney } from "@/src/lib/format";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  findPayslipMetaAllowanceAmount,
  isPayslipMetaAllowanceLine,
  payslipLineDetailForDisplay,
  type PayslipLineItem,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";

export type PayslipPdfDocumentInput = {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
  /** Kept for call-site compatibility — not rendered on the PDF payslip. */
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  isOfficial: boolean;
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    fontSize: 8,
    color: "#111827",
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 6.5,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orgName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 1 },
  payslipTag: {
    fontSize: 7,
    color: "#1d4ed8",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "right",
  },
  period: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
    textAlign: "right",
  },
  metaGrid: {
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  metaItem: { width: "25%", paddingRight: 6 },
  metaValue: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 1 },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#374151",
    marginTop: 6,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 2,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
  },
  lineLabel: { flex: 1, paddingRight: 8 },
  lineDetail: { fontSize: 6.5, color: "#6b7280", marginTop: 1 },
  amount: { fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  netBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  netLabel: {
    fontSize: 7,
    color: "#1d4ed8",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  netAmount: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 1 },
  ytdRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  ytdItem: { width: "25%", marginBottom: 3 },
});

function money(amount: number, currency: string): string {
  return formatMoney(amount, { currency });
}

function isBankDeduction(line: PayslipLineItem): boolean {
  return line.label.startsWith("Bank transfer");
}

function LineList({
  lines,
  currency,
  emptyLabel,
}: {
  lines: PayslipLineItem[];
  currency: string;
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return <Text style={styles.lineDetail}>{emptyLabel}</Text>;
  }
  return (
    <View>
      {lines.map((line, index) => {
        const detail = payslipLineDetailForDisplay(line.detail);
        return (
        <View key={`${line.label}-${index}`} style={styles.lineRow}>
          <View style={styles.lineLabel}>
            <Text>{line.label}</Text>
            {detail ? (
              <Text style={styles.lineDetail}>{detail}</Text>
            ) : null}
          </View>
          <Text style={styles.amount}>{money(line.amount, currency)}</Text>
        </View>
        );
      })}
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function YtdMetricRow({
  currency,
  metrics,
}: {
  currency: string;
  metrics: Array<{ label: string; amount: number }>;
}) {
  return (
    <View style={styles.ytdRow}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.ytdItem}>
          <Text style={styles.label}>{metric.label}</Text>
          <Text>{money(metric.amount, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function PayslipPage({
  payslip,
  meta,
  ytd,
  ytdBreakdown = null,
}: PayslipPdfDocumentInput) {
  const { currency } = payslip;
  const showPrior =
    ytdBreakdown != null && ytdBreakdown.prior.recordCount > 0;
  const employeeDeductions = payslip.deductions.filter(
    (line) => !isBankDeduction(line),
  );
  const employeeDeductionTotal = sumMoney(
    ...employeeDeductions.map((line) => line.amount),
  );
  const salaryAmount =
    findPayslipMetaAllowanceAmount(payslip.earnings, "salary") ??
    (payslip.baseSalary > 0 ? payslip.baseSalary : undefined);
  const travellingAmount = findPayslipMetaAllowanceAmount(
    payslip.earnings,
    "travel",
  );
  const phoneAmount = findPayslipMetaAllowanceAmount(payslip.earnings, "phone");
  const earningsAboveGross = payslip.earnings.filter(
    (line) => !isPayslipMetaAllowanceLine(line),
  );

  return (
    <Page size="A4" style={styles.page} wrap>
      <View wrap>
        <View style={styles.headerRow} wrap={false}>
          <View>
            <Text style={styles.label}>Employer</Text>
            <Text style={styles.orgName}>{meta.organizationName}</Text>
          </View>
          <View>
            <Text style={styles.payslipTag}>Payslip</Text>
            <Text style={styles.period}>{payslip.period.label}</Text>
            <Text style={[styles.label, { textAlign: "right" }]}>
              {payslip.period.payFrequency} · {currency}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <MetaItem label="Employee" value={payslip.employee.displayName} />
            <MetaItem label="Position" value={meta.jobTitle?.trim() || "—"} />
            <MetaItem
              label="NIS NO."
              value={payslip.employee.nisNumber ?? "—"}
            />
            <MetaItem
              label="BIR NO."
              value={payslip.employee.birNumber ?? "—"}
            />
          </View>
          <View style={styles.metaRow}>
            <MetaItem
              label="Salary"
              value={salaryAmount != null ? formatMoney(salaryAmount) : "—"}
            />
            <MetaItem
              label="Travelling"
              value={
                travellingAmount != null ? formatMoney(travellingAmount) : "—"
              }
            />
            <MetaItem
              label="Phone"
              value={phoneAmount != null ? formatMoney(phoneAmount) : "—"}
            />
            <MetaItem
              label="Taxable earnings"
              value={formatMoney(payslip.monthlyTaxableEarnings)}
            />
          </View>
        </View>

        {earningsAboveGross.length > 0 ? (
          <LineList
            lines={earningsAboveGross}
            currency={currency}
            emptyLabel=""
          />
        ) : null}
        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.amount}>Gross pay</Text>
          <Text style={styles.amount}>{money(payslip.grossPay, currency)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Deductions</Text>
        <LineList
          lines={employeeDeductions}
          currency={currency}
          emptyLabel="No employee deductions calculated."
        />
        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.amount}>Total deductions</Text>
          <Text style={styles.amount}>
            {money(employeeDeductionTotal, currency)}
          </Text>
        </View>

        <View style={styles.netBox} wrap={false}>
          <View>
            <Text style={styles.netLabel}>Net pay</Text>
            <Text style={styles.netAmount}>
              {money(payslip.netPay, currency)}
            </Text>
          </View>
          <Text style={styles.lineDetail}>
            Gross {money(payslip.grossPay, currency)} − deductions{" "}
            {money(payslip.totalDeductions, currency)}
          </Text>
        </View>

        {ytd ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>
              Year to date · {ytd.year}
              {showPrior
                ? " (includes prior employer)"
                : ytd.periodCount > 0
                  ? ` (${ytd.periodCount} period${ytd.periodCount === 1 ? "" : "s"})`
                  : " (this slip)"}
            </Text>
            <YtdMetricRow
              currency={currency}
              metrics={
                showPrior && ytdBreakdown
                  ? [
                      {
                        label: "Gross",
                        amount: ytdBreakdown.combined.grossPay,
                      },
                      {
                        label: "NIS",
                        amount: ytdBreakdown.combined.nisEmployee,
                      },
                      {
                        label: "Health Surcharge",
                        amount: ytdBreakdown.combined.healthSurcharge,
                      },
                      { label: "PAYE", amount: ytdBreakdown.combined.paye },
                    ]
                  : [
                      { label: "Gross", amount: ytd.grossPay },
                      { label: "NIS", amount: ytd.nisEmployee },
                      {
                        label: "Health Surcharge",
                        amount: ytd.healthSurcharge,
                      },
                      { label: "PAYE", amount: ytd.paye },
                    ]
              }
            />
          </View>
        ) : null}
      </View>
    </Page>
  );
}

function PayslipPdf({ documents }: { documents: PayslipPdfDocumentInput[] }) {
  return (
    <Document>
      {documents.map((doc, index) => (
        <PayslipPage key={`${doc.payslip.employee.id}-${index}`} {...doc} />
      ))}
    </Document>
  );
}

/** Render one or more payslips to a single PDF buffer (A4 portrait; one page each). */
export async function renderPayslipsPdf(
  documents: PayslipPdfDocumentInput[],
): Promise<Buffer> {
  return renderToBuffer(<PayslipPdf documents={documents} />);
}
