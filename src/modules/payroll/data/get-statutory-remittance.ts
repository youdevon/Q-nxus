import { prisma } from "@/lib/prisma";
import {
  buildMonthlyPeriodBounds,
  parseMonthlyPeriodKey,
} from "@/src/modules/payroll/lib/pay-period";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { resolveDefaultMonthlyReportPeriodKey } from "@/src/modules/payroll/lib/payroll-analytics";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";
import {
  aggregateStatutoryRemittance,
  extractStatutoryRemittanceRow,
  type StatutoryRemittanceTotals,
} from "@/src/modules/payroll/lib/statutory-remittance";

export type StatutoryRemittanceReport = {
  selectedPeriodKey: string;
  periodName: string;
  availablePeriodKeys: string[];
  payslipCount: number;
  totalsByCurrency: StatutoryRemittanceTotals[];
};

/** Period keys with at least one POSTED payslip for this organization. */
async function listPostedPeriodKeysForOrganization(
  organizationId: string,
): Promise<string[]> {
  const periods = await prisma.payrollPeriod.findMany({
    where: {
      organizationId,
      payslips: { some: { status: "POSTED" } },
    },
    select: { periodKey: true },
    orderBy: [{ periodEnd: "desc" }],
  });

  return [
    ...new Set(
      periods
        .map((period) => period.periodKey)
        .filter((key) => parseMonthlyPeriodKey(key) != null),
    ),
  ];
}

/**
 * PAYE / NIS (employee + employer) / Health Surcharge due for a month —
 * summed from POSTED payslip snapshots only, scoped to one organization.
 * Used to prepare the statutory remittance filing/payment for that period.
 */
export async function getStatutoryRemittanceReport(input?: {
  periodKey?: string | null;
  actorUserId?: string | null;
  organizationId?: string | null;
}): Promise<StatutoryRemittanceReport> {
  const organizationId =
    input?.organizationId ??
    (await resolvePayrollOrganization({ actorUserId: input?.actorUserId })).id;

  const availablePeriodKeys =
    await listPostedPeriodKeysForOrganization(organizationId);
  const requested = input?.periodKey?.trim() ?? "";
  const selectedPeriodKey = parseMonthlyPeriodKey(requested)
    ? requested
    : resolveDefaultMonthlyReportPeriodKey({
        postedPeriodKeys: availablePeriodKeys,
      });

  const bounds = buildMonthlyPeriodBounds(selectedPeriodKey);
  const periodName =
    bounds?.name ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;

  const payslips = await prisma.payslip.findMany({
    where: {
      organizationId,
      status: "POSTED",
      payrollPeriod: { periodKey: selectedPeriodKey },
    },
    select: { currency: true, snapshot: true },
  });

  const rows = payslips.map((slip) =>
    extractStatutoryRemittanceRow(slip.snapshot, slip.currency),
  );

  return {
    selectedPeriodKey,
    periodName,
    availablePeriodKeys,
    payslipCount: payslips.length,
    totalsByCurrency: aggregateStatutoryRemittance(rows),
  };
}
