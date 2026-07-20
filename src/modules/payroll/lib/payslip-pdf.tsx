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
import type {
  PayslipLineItem,
  PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";

export type PayslipPdfDocumentInput = {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
  ytdBreakdown?: PayslipYtdBreakdown | null;
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
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  metaItem: { width: "25%", marginBottom: 5, paddingRight: 6 },
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
  ytdItem: { width: "16.6%", marginBottom: 3 },
  ytdGroup: { marginBottom: 4 },
  footer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    fontSize: 6.5,
    color: "#6b7280",
  },
});

function money(amount: number, currency: string): string {
  return formatMoney(amount, { currency });
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
      {lines.map((line, index) => (
        <View key={`${line.label}-${index}`} style={styles.lineRow}>
          <View style={styles.lineLabel}>
            <Text>{line.label}</Text>
            {line.detail ? (
              <Text style={styles.lineDetail}>{line.detail}</Text>
            ) : null}
          </View>
          <Text style={styles.amount}>{money(line.amount, currency)}</Text>
        </View>
      ))}
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
  isOfficial,
}: PayslipPdfDocumentInput) {
  const { currency } = payslip;
  const primaryBank = payslip.bankDistribution?.find(
    (line) => line.kind === "REMAINDER",
  );
  const showSplit =
    ytdBreakdown != null && ytdBreakdown.prior.recordCount > 0;

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* wrap so dense slips continue onto a second page instead of clipping */}
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
              Currency {currency}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MetaItem label="Employee" value={payslip.employee.displayName} />
          <MetaItem
            label="Employee no."
            value={payslip.employee.employeeNumber}
          />
          <MetaItem label="Position" value={meta.jobTitle?.trim() || "—"} />
          <MetaItem
            label="Department"
            value={meta.departmentName?.trim() || "—"}
          />
          <MetaItem label="NIS no." value={payslip.employee.nisNumber ?? "—"} />
          <MetaItem label="BIR no." value={payslip.employee.birNumber ?? "—"} />
          <MetaItem
            label="Gross pay"
            value={money(payslip.grossPay, currency)}
          />
          <MetaItem
            label="Taxable"
            value={money(payslip.monthlyTaxableEarnings, currency)}
          />
        </View>

        <Text style={styles.sectionTitle}>Earnings</Text>
        <LineList
          lines={payslip.earnings}
          currency={currency}
          emptyLabel="No earnings on file."
        />

        <Text style={styles.sectionTitle}>Deductions</Text>
        <LineList
          lines={payslip.deductions}
          currency={currency}
          emptyLabel="No employee deductions calculated."
        />
        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.amount}>Total deductions</Text>
          <Text style={styles.amount}>
            {money(payslip.totalDeductions, currency)}
          </Text>
        </View>

        <View style={styles.netBox} wrap={false}>
          <View>
            <Text style={styles.netLabel}>Net pay</Text>
            <Text style={styles.netAmount}>
              {money(payslip.netPay, currency)}
            </Text>
            {primaryBank ? (
              <Text style={styles.lineDetail}>
                Paid to {primaryBank.bankName} ({primaryBank.accountNumberMasked})
              </Text>
            ) : null}
          </View>
          <Text style={styles.lineDetail}>
            Gross {money(payslip.grossPay, currency)} − deductions{" "}
            {money(payslip.totalDeductions, currency)}
          </Text>
        </View>

        {ytd && (showSplit || ytd.periodCount > 0) ? (
          showSplit && ytdBreakdown ? (
            <View wrap={false}>
              <View style={styles.ytdGroup}>
                <Text style={styles.sectionTitle}>
                  Prior employer · {ytdBreakdown.year} (
                  {ytdBreakdown.prior.recordCount} record
                  {ytdBreakdown.prior.recordCount === 1 ? "" : "s"})
                </Text>
                <YtdMetricRow
                  currency={currency}
                  metrics={[
                    {
                      label: "Taxable",
                      amount: ytdBreakdown.prior.taxableIncome,
                    },
                    { label: "PAYE", amount: ytdBreakdown.prior.paye },
                    { label: "NIS", amount: ytdBreakdown.prior.nisEmployee },
                    {
                      label: "Health",
                      amount: ytdBreakdown.prior.healthSurcharge,
                    },
                  ]}
                />
              </View>
              <View style={styles.ytdGroup}>
                <Text style={styles.sectionTitle}>
                  This employer · {ytdBreakdown.year} (
                  {ytdBreakdown.currentEmployer.periodCount} period
                  {ytdBreakdown.currentEmployer.periodCount === 1 ? "" : "s"})
                </Text>
                <YtdMetricRow
                  currency={currency}
                  metrics={[
                    {
                      label: "Gross",
                      amount: ytdBreakdown.currentEmployer.grossPay,
                    },
                    {
                      label: "Deductions",
                      amount: ytdBreakdown.currentEmployer.totalDeductions,
                    },
                    {
                      label: "PAYE",
                      amount: ytdBreakdown.currentEmployer.paye,
                    },
                    {
                      label: "NIS",
                      amount: ytdBreakdown.currentEmployer.nisEmployee,
                    },
                    {
                      label: "Health",
                      amount: ytdBreakdown.currentEmployer.healthSurcharge,
                    },
                    {
                      label: "Net",
                      amount: ytdBreakdown.currentEmployer.netPay,
                    },
                  ]}
                />
              </View>
              <View style={styles.ytdGroup}>
                <Text style={styles.sectionTitle}>
                  Combined · {ytdBreakdown.year}
                </Text>
                <YtdMetricRow
                  currency={currency}
                  metrics={[
                    {
                      label: "Taxable",
                      amount: ytdBreakdown.combined.taxableEarnings,
                    },
                    { label: "PAYE", amount: ytdBreakdown.combined.paye },
                    {
                      label: "NIS",
                      amount: ytdBreakdown.combined.nisEmployee,
                    },
                    {
                      label: "Health",
                      amount: ytdBreakdown.combined.healthSurcharge,
                    },
                    {
                      label: "Gross",
                      amount: ytdBreakdown.combined.grossPay,
                    },
                    { label: "Net", amount: ytdBreakdown.combined.netPay },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View wrap={false}>
              <Text style={styles.sectionTitle}>
                Year to date · {ytd.year} ({ytd.periodCount} period
                {ytd.periodCount === 1 ? "" : "s"})
              </Text>
              <YtdMetricRow
                currency={currency}
                metrics={[
                  { label: "Gross", amount: ytd.grossPay },
                  { label: "Deductions", amount: ytd.totalDeductions },
                  { label: "PAYE", amount: ytd.paye },
                  { label: "NIS", amount: ytd.nisEmployee },
                  { label: "Health", amount: ytd.healthSurcharge },
                  { label: "Net", amount: ytd.netPay },
                ]}
              />
            </View>
          )
        ) : null}

        {payslip.employerContributions.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>
              Employer contributions (informational — not deducted)
            </Text>
            <LineList
              lines={payslip.employerContributions}
              currency={currency}
              emptyLabel="None"
            />
          </View>
        ) : null}

        <View style={styles.footer} wrap={false}>
          <Text>
            {isOfficial
              ? "Official payslip — amounts frozen from a posted pay run."
              : "Preview — not an official payslip. Pay runs have not been posted."}
          </Text>
        </View>
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
