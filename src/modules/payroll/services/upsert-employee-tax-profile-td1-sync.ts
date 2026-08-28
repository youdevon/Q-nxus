import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaRuntime } from "@/generated/prisma/client";

function toDecimal(value: number | null): Prisma.Decimal | null {
  if (value == null) {
    return null;
  }
  return new PrismaRuntime.Decimal(value.toFixed(2));
}

/**
 * Upsert tax-year TD1 onto EmployeeTaxProfile (sole store).
 */
export async function upsertEmployeeTaxProfileTd1Sync(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    employeeId: string;
    taxYear: number;
    td1OtherApprovedAnnual: number | null;
    userId?: string | null;
  },
): Promise<{ id: string }> {
  const effectiveFrom = new Date(Date.UTC(input.taxYear, 0, 1));
  const td1 = toDecimal(input.td1OtherApprovedAnnual);

  const profile = await tx.employeeTaxProfile.upsert({
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
      taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
      taxProfileStatus: "ACTIVE",
      personalAllowanceSource: "STATUTORY_DEFAULT",
      td1OtherApprovedAnnual: td1,
      effectiveFrom,
      createdByUserId: input.userId ?? null,
      updatedByUserId: input.userId ?? null,
    },
    update: {
      td1OtherApprovedAnnual: td1,
      updatedByUserId: input.userId ?? null,
    },
    select: { id: true },
  });

  return profile;
}
