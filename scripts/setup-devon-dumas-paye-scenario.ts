import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getEmployeeTaxYearPage } from "../src/modules/payroll/data/get-employee-tax-year-page";

const TAX_YEAR = 2026;

/**
 * Worksheet (user):
 *   YTD taxable to 30 Jun     69,000
 *   Projected Jul–Dec        108,000  (= 6 × 18,000)
 *   Annual taxable           177,000
 *   Combined allowance        95,305  (= 90,000 personal + 5,305 qualifying)
 *   Chargeable                81,695
 *   Annual tax @ 25%          20,423.75
 *   Prior PAYE credit          3,645
 *   Remaining tax             16,778.75
 *   Recommended / month        2,796.46
 */
async function main() {
  const employee = await prisma.employee.findFirst({
    where: {
      AND: [
        { firstName: { contains: "Devon", mode: "insensitive" } },
        { lastName: { contains: "Dumas", mode: "insensitive" } },
      ],
    },
    include: {
      payrollProfile: true,
      contracts: {
        where: { isCurrent: true },
        include: {
          allowances: { include: { category: true } },
        },
      },
      taxProfiles: { where: { taxYear: TAX_YEAR } },
    },
  });

  if (!employee) {
    console.error("Devon Dumas not found.");
    process.exit(1);
  }

  console.log(
    `Found ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) id=${employee.id}`,
  );

  const hireDate = new Date("2026-07-01T00:00:00.000Z");
  const priorEnd = new Date("2026-07-25T00:00:00.000Z");
  const asOfDate = new Date("2026-06-30T00:00:00.000Z");

  const priorTaxable = 69_000;
  const priorPaye = 3_645;
  /** Qualifying beyond $90k personal allowance (TD1 / combined worksheet). */
  const qualifyingOther = 5_305;
  const orgId = employee.organizationId;

  async function ensureCategory(name: string) {
    const code = name.toUpperCase().replace(/\s+/g, "_").slice(0, 32);
    const existing = await prisma.allowanceCategory.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { code },
        ],
      },
    });
    if (existing) return existing;
    return prisma.allowanceCategory.create({
      data: {
        organizationId: orgId,
        name,
        code,
        isActive: true,
      },
    });
  }

  const travelCat = await ensureCategory("Travelling");
  const phoneCat = await ensureCategory("Phone");

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: { hireDate },
    });

    await tx.employeePriorEmploymentYtd.updateMany({
      where: { employeeId: employee.id, taxYear: TAX_YEAR, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    await tx.employeePriorEmploymentYtd.create({
      data: {
        organizationId: orgId,
        employeeId: employee.id,
        taxYear: TAX_YEAR,
        employerName: "Previous employer",
        employmentEndDate: priorEnd,
        asOfDate,
        currencyCode: "TTD",
        taxableIncomeYtd: new Prisma.Decimal(priorTaxable.toFixed(2)),
        payeDeductedYtd: new Prisma.Decimal(priorPaye.toFixed(2)),
        // Qualifying $5,305 is carried on TD1 other — avoid double-counting via NIS.
        nisEmployeeYtd: null,
        healthSurchargeYtd: null,
        notes:
          `Worksheet plug-in: taxable YTD ${priorTaxable.toFixed(2)} and PAYE ${priorPaye.toFixed(2)} as of 30 Jun ${TAX_YEAR}. Qualifying ${qualifyingOther.toFixed(2)} on tax profile TD1 other (combined allowance 95,305 with statutory 90,000).`,
        status: "ACTIVE",
        verified: true,
        verifiedAt: new Date(),
      },
    });

    const profileData = {
      previousEmploymentStatus: "PREVIOUS_EMPLOYMENT" as const,
      previousEmploymentDeclared: true,
      previousEmploymentVerified: true,
      taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED" as const,
      cumulativeCalculationEnabled: true,
      taxProfileStatus: "ACTIVE" as const,
      // Statutory personal allowance ($90k) via null override + TD1 other = $5,305.
      personalAllowance: null,
      personalAllowanceSource: "STATUTORY_DEFAULT" as const,
      td1Submitted: true,
      td1OtherApprovedAnnual: new Prisma.Decimal(qualifyingOther.toFixed(2)),
    };

    const existingProfile = await tx.employeeTaxProfile.findFirst({
      where: { employeeId: employee.id, taxYear: TAX_YEAR },
    });
    if (existingProfile) {
      await tx.employeeTaxProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
      });
    } else {
      await tx.employeeTaxProfile.create({
        data: {
          organizationId: orgId,
          employeeId: employee.id,
          taxYear: TAX_YEAR,
          effectiveFrom: new Date(`${TAX_YEAR}-01-01T00:00:00.000Z`),
          ...profileData,
        },
      });
    }

    const contract = employee.contracts[0];
    if (!contract) {
      throw new Error("No current contract to update.");
    }

    await tx.employmentContract.update({
      where: { id: contract.id },
      data: {
        baseSalary: new Prisma.Decimal("16000.00"),
        startDate: hireDate,
        currency: "TTD",
      },
    });

    await tx.employmentContractAllowance.deleteMany({
      where: { contractId: contract.id },
    });

    await tx.employmentContractAllowance.createMany({
      data: [
        {
          contractId: contract.id,
          categoryId: travelCat.id,
          amount: new Prisma.Decimal("1500.00"),
          frequency: "MONTHLY",
          isTaxable: true,
        },
        {
          contractId: contract.id,
          categoryId: phoneCat.id,
          amount: new Prisma.Decimal("500.00"),
          frequency: "MONTHLY",
          isTaxable: true,
        },
      ],
    });

    if (employee.payrollProfile) {
      await tx.payrollProfile.update({
        where: { id: employee.payrollProfile.id },
        data: { payFrequency: "MONTHLY", isPayrollReady: true },
      });
    } else {
      await tx.payrollProfile.create({
        data: {
          employeeId: employee.id,
          payFrequency: "MONTHLY",
          isPayrollReady: true,
        },
      });
    }
  });

  const page = await getEmployeeTaxYearPage(employee.id, TAX_YEAR);
  if (!page?.annualProjection) {
    console.log("No projection available.", page?.projectionContext);
    process.exit(1);
  }

  const p = page.annualProjection;
  const expected = {
    annualTaxable: 177_000,
    allowanceCombined: 95_305,
    chargeable: 81_695,
    annualTax: 20_423.75,
    priorPaye: 3_645,
    remainingTax: 16_778.75,
    payePerPeriod: 2_796.46,
  };

  const combinedAllowance =
    p.personalAllowance + p.qualifying.allowableQualifyingDeduction;

  console.log("\n=== Live projection vs worksheet ===");
  console.log({
    remainingPeriods: p.periods.remainingPeriods,
    asOf: p.periods.asOfDate,
    previousTaxable: p.previousEmployer.taxableEarnings,
    previousPaye: p.previousEmployerPaye,
    projectedRemaining: p.projectedRemaining.taxableEarnings,
    annualTaxable: p.projectedAnnual.taxableEarnings,
    personalAllowance: p.personalAllowance,
    qualifying: p.qualifying.allowableQualifyingDeduction,
    combinedAllowance,
    chargeable: p.projectedChargeableIncome,
    annualTax: p.projectedAnnualTaxLiability,
    remainingTax: p.remainingTaxLiability,
    payePerPeriod: p.recommendedPayePerPeriod,
  });
  console.log("\nExpected:", expected);
  console.log("\nMatch checks:");
  console.log(
    "  annual taxable",
    p.projectedAnnual.taxableEarnings === expected.annualTaxable,
  );
  console.log(
    "  combined allowance",
    Math.abs(combinedAllowance - expected.allowanceCombined) < 0.01,
  );
  console.log(
    "  chargeable",
    Math.abs(p.projectedChargeableIncome - expected.chargeable) < 0.01,
  );
  console.log(
    "  annual tax",
    Math.abs(p.projectedAnnualTaxLiability - expected.annualTax) < 0.01,
  );
  console.log(
    "  remaining tax",
    Math.abs(p.remainingTaxLiability - expected.remainingTax) < 0.01,
  );
  console.log(
    "  PAYE / period",
    p.recommendedPayePerPeriod != null &&
      Math.abs(p.recommendedPayePerPeriod - expected.payePerPeriod) < 0.01,
  );
  console.log(
    "\nTax-year URL: /payroll/employees/" +
      employee.id +
      "/tax-year?year=" +
      TAX_YEAR,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
