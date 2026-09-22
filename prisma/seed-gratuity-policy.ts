import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

/**
 * Seed the TT MoF/IRD contract gratuity policy (2026) when none exists.
 */
export async function seedGratuityPolicies(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const existing = await prisma.gratuityPolicy.findFirst({
    where: { organizationId },
    select: { id: true },
  });

  if (existing) {
    console.log("Gratuity policy already present — skipping seed.");
    return;
  }

  await prisma.gratuityPolicy.create({
    data: {
      organizationId,
      countryCode: "TT",
      currencyCode: "TTD",
      formulaKind: "PCT_OF_TERM_EARNINGS",
      defaultRatePercent: new Prisma.Decimal("20"),
      taxMode: "TIERED",
      flatTaxRatePercent: null,
      applyPersonalAllowance: false,
      minServiceMonths: null,
      daysPerYearOfService: null,
      daysInYearBasis: 26,
      eligibilityOnFullTermOnly: false,
      prorateOnEarlyExit: true,
      payTiming: "OFF_CYCLE_AFTER_END",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: null,
      versionLabel: "TT 2026",
      sourceReference:
        "Ministry of Finance Call Circular / IRD contract gratuity guidelines",
      isActive: true,
      taxBands: {
        create: [
          {
            upToAmount: new Prisma.Decimal("1000000"),
            ratePercent: new Prisma.Decimal("25"),
            sortOrder: 0,
          },
          {
            upToAmount: null,
            ratePercent: new Prisma.Decimal("30"),
            sortOrder: 1,
          },
        ],
      },
    },
  });

  console.log("Seeded TT 2026 gratuity policy.");
}
