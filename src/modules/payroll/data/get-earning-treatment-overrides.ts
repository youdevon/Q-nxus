import { prisma } from "@/lib/prisma";
import {
  isTaxableFromTreatment,
} from "@/src/modules/payroll/lib/earning-treatment";

export type EarningTreatmentOverrideRow = {
  id: string;
  componentDefinitionId: string;
  componentCode: string;
  componentName: string;
  defaultTaxTreatment: string;
  taxTreatment: string;
  includeInProjectedEarnings: boolean;
  reason: string;
  supportingReference: string | null;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  enteredByUserId: string;
  approvedByUserId: string | null;
  updatedAt: string;
};

export async function listEarningTreatmentOverrides(
  employeeId: string,
): Promise<EarningTreatmentOverrideRow[]> {
  const rows = await prisma.employeeEarningTreatmentOverride.findMany({
    where: { employeeId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      componentDefinition: {
        select: { id: true, code: true, name: true, taxTreatment: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    componentDefinitionId: row.componentDefinitionId,
    componentCode: row.componentDefinition.code,
    componentName: row.componentDefinition.name,
    defaultTaxTreatment: row.componentDefinition.taxTreatment,
    taxTreatment: row.taxTreatment,
    includeInProjectedEarnings: row.includeInProjectedEarnings,
    reason: row.reason,
    supportingReference: row.supportingReference,
    status: row.status,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo
      ? row.effectiveTo.toISOString().slice(0, 10)
      : null,
    enteredByUserId: row.enteredByUserId,
    approvedByUserId: row.approvedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export type ApprovedEarningTreatmentOverride = {
  taxTreatment: "TAXABLE_EMPLOYMENT" | "NON_TAXABLE" | "NIS_ONLY" | "PAYE_EXEMPT";
  includeInProjectedEarnings: boolean;
  isTaxable: boolean;
};

/** Approved overrides effective for a period end date, keyed by component id. */
export async function getApprovedEarningTreatmentOverridesForPeriod(
  employeeId: string,
  periodEnd: Date,
): Promise<Map<string, ApprovedEarningTreatmentOverride>> {
  const rows = await prisma.employeeEarningTreatmentOverride.findMany({
    where: {
      employeeId,
      status: "APPROVED",
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
    },
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    select: {
      componentDefinitionId: true,
      taxTreatment: true,
      includeInProjectedEarnings: true,
    },
  });

  const map = new Map<string, ApprovedEarningTreatmentOverride>();
  for (const row of rows) {
    const taxTreatment = row.taxTreatment as ApprovedEarningTreatmentOverride["taxTreatment"];
    map.set(row.componentDefinitionId, {
      taxTreatment,
      includeInProjectedEarnings: row.includeInProjectedEarnings,
      isTaxable: isTaxableFromTreatment(taxTreatment),
    });
  }
  return map;
}
