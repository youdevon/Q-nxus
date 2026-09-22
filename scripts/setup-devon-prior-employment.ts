/**
 * One-off: load Devon Dumas prior-employment YTD for 2026 tax year.
 *
 * Usage: npx tsx scripts/setup-devon-prior-employment.ts
 */
import "dotenv/config";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { syncTaxProfilePreviousEmploymentFlags } from "@/src/modules/payroll/services/sync-tax-profile-previous-employment";

const DEVON_EMPLOYEE_ID = "cmrp485h2000di6sbsc9pe477";
const TAX_YEAR = 2026;
const ADMIN_USER_ID = "user-devon-admin";

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

async function main() {
  const employee = await prisma.employee.findUnique({
    where: { id: DEVON_EMPLOYEE_ID },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      hireDate: true,
    },
  });

  if (!employee) {
    throw new Error(`Employee ${DEVON_EMPLOYEE_ID} not found.`);
  }

  const notes = [
    "Prior employer: ~$10,300 salary + $1,200 non-taxable travelling ($11,500 cost).",
    "YTD as of 2026-05-31: gross/taxable 57500, PAYE 3037.40, NIS 2462.00, Health Surcharge 173.25.",
    "Employment with prior employer ended 2026-06-30 (day before Q-NXUS start 2026-07-01).",
    "Update employer name when TD4 / letter is available.",
  ].join(" ");

  await prisma.$transaction(async (tx) => {
    await tx.employeePriorEmploymentYtd.updateMany({
      where: {
        employeeId: employee.id,
        taxYear: TAX_YEAR,
        status: "ACTIVE",
      },
      data: { status: "ARCHIVED" },
    });

    const taxProfile = await tx.employeeTaxProfile.findUnique({
      where: {
        employeeId_taxYear: {
          employeeId: employee.id,
          taxYear: TAX_YEAR,
        },
      },
      select: { id: true },
    });

    const record = await tx.employeePriorEmploymentYtd.create({
      data: {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        taxYear: TAX_YEAR,
        taxProfileId: taxProfile?.id ?? null,
        employerName: "Previous Employer",
        employerBirNumber: null,
        employmentStartDate: new Date("2026-01-01T00:00:00.000Z"),
        employmentEndDate: new Date("2026-06-30T00:00:00.000Z"),
        asOfDate: new Date("2026-05-31T00:00:00.000Z"),
        currencyCode: "TTD",
        taxableIncomeYtd: dec(57_500),
        payeDeductedYtd: dec(3_037.4),
        nisEmployeeYtd: dec(2_462),
        healthSurchargeYtd: dec(173.25),
        status: "ACTIVE",
        verified: true,
        verifiedAt: new Date(),
        verifiedByUserId: ADMIN_USER_ID,
        notes,
        createdByUserId: ADMIN_USER_ID,
        updatedByUserId: ADMIN_USER_ID,
      },
      select: { id: true },
    });

    await syncTaxProfilePreviousEmploymentFlags(tx, {
      organizationId: employee.organizationId,
      employeeId: employee.id,
      taxYear: TAX_YEAR,
      userId: ADMIN_USER_ID,
    });

    console.log(
      JSON.stringify(
        {
          employee: `${employee.firstName} ${employee.lastName} (#${employee.employeeNumber})`,
          hireDate: employee.hireDate.toISOString().slice(0, 10),
          priorEmploymentRecordId: record.id,
          taxYear: TAX_YEAR,
          ytd: {
            asOfDate: "2026-05-31",
            taxableIncomeYtd: 57_500,
            payeDeductedYtd: 3_037.4,
            nisEmployeeYtd: 2_462,
            healthSurchargeYtd: 173.25,
          },
          priorEmploymentEnd: "2026-06-30",
        },
        null,
        2,
      ),
    );
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
