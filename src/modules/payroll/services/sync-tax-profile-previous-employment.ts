import type { Prisma } from "@/generated/prisma/client";

export type PriorEmploymentTaxMethodSync = {
  taxCalculationMethod:
    | "PREVIOUS_INCOME_INCLUDED"
    | "STANDARD_NON_CUMULATIVE";
  cumulativeCalculationEnabled: boolean;
};

/**
 * Decide tax-method adjustments when prior-employment ACTIVE rows change.
 * - Last prior archived → restore standard non-cumulative (prevents zero PAYE).
 * - First prior added while still on standard non-cumulative → previous-income mode.
 * - Manual / special / explicit cumulative methods are left alone when priors remain.
 */
export function resolvePriorEmploymentTaxMethodSync(input: {
  hasActivePriorRecords: boolean;
  currentMethod: string | null | undefined;
}): PriorEmploymentTaxMethodSync | null {
  if (!input.hasActivePriorRecords) {
    return {
      taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
      cumulativeCalculationEnabled: false,
    };
  }

  const method = input.currentMethod ?? "STANDARD_NON_CUMULATIVE";
  if (method === "STANDARD_NON_CUMULATIVE") {
    return {
      taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED",
      cumulativeCalculationEnabled: true,
    };
  }

  return null;
}

/**
 * Keep EmployeeTaxProfile previous-employment flags aligned with ACTIVE YTD rows.
 * - ACTIVE prior rows → PREVIOUS_EMPLOYMENT + declared true
 * - Last prior removed → if was PREVIOUS, set NO_PREVIOUS_EMPLOYMENT
 *   (UNKNOWN is left alone)
 */
export async function syncTaxProfilePreviousEmploymentFlags(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    employeeId: string;
    taxYear: number;
    userId?: string | null;
  },
): Promise<void> {
  const active = await tx.employeePriorEmploymentYtd.findMany({
    where: {
      employeeId: input.employeeId,
      taxYear: input.taxYear,
      status: "ACTIVE",
    },
    select: {
      verified: true,
    },
  });

  const hasActive = active.length > 0;
  const verified = hasActive && active.every((row) => row.verified);
  const effectiveFrom = new Date(Date.UTC(input.taxYear, 0, 1));

  const existing = await tx.employeeTaxProfile.findUnique({
    where: {
      employeeId_taxYear: {
        employeeId: input.employeeId,
        taxYear: input.taxYear,
      },
    },
    select: {
      taxCalculationMethod: true,
      previousEmploymentStatus: true,
    },
  });

  const methodSync = resolvePriorEmploymentTaxMethodSync({
    hasActivePriorRecords: hasActive,
    currentMethod: existing?.taxCalculationMethod,
  });

  let previousEmploymentStatus:
    | "NO_PREVIOUS_EMPLOYMENT"
    | "PREVIOUS_EMPLOYMENT"
    | "UNKNOWN_PREVIOUS_INCOME";
  let previousEmploymentDeclared: boolean;

  if (hasActive) {
    previousEmploymentStatus = "PREVIOUS_EMPLOYMENT";
    previousEmploymentDeclared = true;
  } else if (existing?.previousEmploymentStatus === "PREVIOUS_EMPLOYMENT") {
    previousEmploymentStatus = "NO_PREVIOUS_EMPLOYMENT";
    previousEmploymentDeclared = false;
  } else if (existing) {
    // Leave UNKNOWN or explicit NO_PREVIOUS as stored.
    previousEmploymentStatus = existing.previousEmploymentStatus;
    previousEmploymentDeclared = false;
  } else {
    previousEmploymentStatus = "UNKNOWN_PREVIOUS_INCOME";
    previousEmploymentDeclared = false;
  }

  await tx.employeeTaxProfile.upsert({
    where: {
      employeeId_taxYear: {
        employeeId: input.employeeId,
        taxYear: input.taxYear,
      },
    },
    create: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      taxYear: input.taxYear,
      taxCalculationMethod: hasActive
        ? "PREVIOUS_INCOME_INCLUDED"
        : "STANDARD_NON_CUMULATIVE",
      taxProfileStatus: "ACTIVE",
      personalAllowanceSource: "STATUTORY_DEFAULT",
      previousEmploymentStatus,
      previousEmploymentDeclared,
      previousEmploymentVerified: verified,
      cumulativeCalculationEnabled: hasActive,
      effectiveFrom,
      createdByUserId: input.userId ?? null,
      updatedByUserId: input.userId ?? null,
    },
    update: {
      previousEmploymentStatus,
      previousEmploymentDeclared,
      previousEmploymentVerified: verified,
      ...(methodSync ?? {}),
      updatedByUserId: input.userId ?? null,
    },
  });
}
