import { prisma } from "@/lib/prisma";
import {
  toProjectedTaxYearPosition,
  type ProjectedTaxYearPosition,
} from "@/src/modules/payroll/lib/projected-tax-year-position";

/** Latest approved annual PAYE projection for an employee tax year. */
export async function getApprovedProjectedTaxYearPosition(
  employeeId: string,
  taxYear: number,
): Promise<ProjectedTaxYearPosition | null> {
  const row = await prisma.employeeAnnualPayrollProjection.findFirst({
    where: {
      employeeId,
      taxYear,
      status: "APPROVED",
    },
    orderBy: [{ version: "desc" }],
  });

  if (!row) {
    return null;
  }

  return toProjectedTaxYearPosition(row);
}

export async function listSavedAnnualProjections(
  employeeId: string,
  taxYear: number,
) {
  const rows = await prisma.employeeAnnualPayrollProjection.findMany({
    where: { employeeId, taxYear },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      version: true,
      status: true,
      calculationDate: true,
      remainingTaxLiability: true,
      recommendedPayePerPeriod: true,
      remainingPayrollPeriods: true,
      projectedAnnualTaxLiability: true,
      appliedToPeriodEnd: true,
      generatedByUserId: true,
      approvedByUserId: true,
      approvedAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status,
    calculationDate: row.calculationDate.toISOString().slice(0, 10),
    remainingTaxLiability: Number(row.remainingTaxLiability.toString()),
    recommendedPayePerPeriod:
      row.recommendedPayePerPeriod == null
        ? null
        : Number(row.recommendedPayePerPeriod.toString()),
    remainingPayrollPeriods: row.remainingPayrollPeriods,
    projectedAnnualTaxLiability: Number(
      row.projectedAnnualTaxLiability.toString(),
    ),
    appliedToPeriodEnd: row.appliedToPeriodEnd
      ? row.appliedToPeriodEnd.toISOString().slice(0, 10)
      : null,
    generatedByUserId: row.generatedByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export type SavedAnnualProjectionRow = Awaited<
  ReturnType<typeof listSavedAnnualProjections>
>[number];
