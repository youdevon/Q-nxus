import type { Prisma } from "@/generated/prisma/client";

/**
 * Keep EmployeeTaxProfile previous-employment flags aligned with ACTIVE YTD rows.
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

  const declared = active.length > 0;
  const verified = declared && active.every((row) => row.verified);
  const effectiveFrom = new Date(Date.UTC(input.taxYear, 0, 1));

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
      taxCalculationMethod: declared
        ? "PREVIOUS_INCOME_INCLUDED"
        : "STANDARD_NON_CUMULATIVE",
      taxProfileStatus: "ACTIVE",
      personalAllowanceSource: "STATUTORY_DEFAULT",
      previousEmploymentDeclared: declared,
      previousEmploymentVerified: verified,
      effectiveFrom,
      createdByUserId: input.userId ?? null,
      updatedByUserId: input.userId ?? null,
    },
    update: {
      previousEmploymentDeclared: declared,
      previousEmploymentVerified: verified,
      updatedByUserId: input.userId ?? null,
    },
  });
}
