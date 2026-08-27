import { prisma } from "@/lib/prisma";
import { toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";

export type StatutoryOverrideAmounts = {
  id: string;
  payeAmount: number | null;
  nisEmployeeAmount: number | null;
  healthSurchargeAmount: number | null;
  reason: string;
  status: string;
};

/** Approved override for an employee period (applied in payslip assembly). */
export async function getApprovedStatutoryOverrideForPeriod(input: {
  employeeId: string;
  periodEnd: Date | string;
}): Promise<StatutoryOverrideAmounts | null> {
  const periodEndKey = toStatutoryAsOfKey(input.periodEnd);
  const periodEnd = new Date(`${periodEndKey}T00:00:00.000Z`);

  const row = await prisma.employeePayrollStatutoryOverride.findFirst({
    where: {
      employeeId: input.employeeId,
      periodEnd,
      status: { in: ["APPROVED", "APPLIED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    payeAmount:
      row.payeAmount != null ? Number(row.payeAmount.toString()) : null,
    nisEmployeeAmount:
      row.nisEmployeeAmount != null
        ? Number(row.nisEmployeeAmount.toString())
        : null,
    healthSurchargeAmount:
      row.healthSurchargeAmount != null
        ? Number(row.healthSurchargeAmount.toString())
        : null,
    reason: row.reason,
    status: row.status,
  };
}

export async function listEmployeeStatutoryOverrides(
  employeeId: string,
  taxYear: number,
) {
  const rows = await prisma.employeePayrollStatutoryOverride.findMany({
    where: { employeeId, taxYear },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    taxYear: row.taxYear,
    periodEnd: row.periodEnd.toISOString().slice(0, 10),
    payeAmount: row.payeAmount?.toString() ?? null,
    nisEmployeeAmount: row.nisEmployeeAmount?.toString() ?? null,
    healthSurchargeAmount: row.healthSurchargeAmount?.toString() ?? null,
    reason: row.reason,
    applyScope: row.applyScope,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    updatedAt: row.updatedAt.toISOString(),
  }));
}
