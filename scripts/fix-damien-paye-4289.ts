/**
 * Correct Damien Leach (#17) PAYE overrides to 4,289 for all months
 * after August 2026 through contract end / year-end.
 *
 *   node --import tsx --env-file=.env scripts/fix-damien-paye-4289.ts
 */

import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../src/modules/audit/services/record-audit-event";
import {
  filterOpenPeriodEnds,
  listRemainingMonthlyPeriodEnds,
} from "../src/modules/payroll/lib/remaining-payroll-periods";
import { recalculateAfterTaxChange } from "../src/modules/payroll/services/recalculate-after-tax-change";

const TAX_YEAR = 2026;
const PAYE = 4_289;
const REASON =
  "August 2026 in-house payroll worksheet — Damien PAYE corrected to 4289 for remaining periods after August.";

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function main() {
  const employee = await prisma.employee.findFirst({
    where: { employeeNumber: "17" },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      terminationDate: true,
      contracts: {
        where: { status: "ACTIVE" },
        select: { endDate: true },
        take: 1,
      },
    },
  });
  if (!employee) {
    throw new Error("Damien Leach (#17) not found.");
  }

  const yearEnd = new Date(`${TAX_YEAR}-12-31T00:00:00.000Z`);
  const employmentEnd =
    employee.terminationDate ?? employee.contracts[0]?.endDate ?? null;
  let projectionEndDate = yearEnd;
  if (
    employmentEnd &&
    employmentEnd.getUTCFullYear() === TAX_YEAR &&
    employmentEnd.getTime() < yearEnd.getTime()
  ) {
    projectionEndDate = employmentEnd;
  }

  // Strictly after August
  const asOfDate = new Date(`${TAX_YEAR}-08-31T00:00:00.000Z`);
  const periodEnds = listRemainingMonthlyPeriodEnds({
    taxYear: TAX_YEAR,
    asOfDate,
    projectionEndDate,
    employmentStartDate: employee.hireDate,
  });

  const posted = await prisma.payslip.findMany({
    where: {
      employeeId: employee.id,
      status: "POSTED",
      payrollPeriod: { periodEnd: { in: periodEnds } },
    },
    select: { payrollPeriod: { select: { periodEnd: true } } },
  });
  const postedKeys = new Set(
    posted.map((slip) => isoDate(slip.payrollPeriod.periodEnd)),
  );
  const { open, skippedPosted } = filterOpenPeriodEnds(periodEnds, postedKeys);

  const actorUserId =
    (
      await prisma.employeeTaxProfile.findFirst({
        where: { taxYear: TAX_YEAR },
        select: { createdByUserId: true },
        orderBy: { updatedAt: "desc" },
      })
    )?.createdByUserId ??
    (
      await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!actorUserId) {
    throw new Error("No user found for audit fields.");
  }

  console.log(`${employee.firstName} ${employee.lastName}`);
  console.log(`projection end: ${isoDate(projectionEndDate)}`);
  console.log(
    `PAYE ${PAYE.toFixed(2)} → ${open.map(isoDate).join(", ") || "(none)"}`,
  );
  if (skippedPosted.length > 0) {
    console.log(`skipped posted: ${skippedPosted.map(isoDate).join(", ")}`);
  }

  if (open.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  const payeDecimal = new Prisma.Decimal(PAYE.toFixed(2));

  await prisma.$transaction(async (transaction) => {
    for (const periodEnd of open) {
      await transaction.employeePayrollStatutoryOverride.upsert({
        where: {
          employeeId_periodEnd: {
            employeeId: employee.id,
            periodEnd,
          },
        },
        create: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          taxYear: TAX_YEAR,
          periodEnd,
          payeAmount: payeDecimal,
          reason: REASON,
          status: "APPROVED",
          requestedByUserId: actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
        update: {
          payeAmount: payeDecimal,
          reason: REASON,
          status: "APPROVED",
          requestedByUserId: actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
          rejectedReason: null,
        },
      });
    }

    await recordAuditEvent(transaction, {
      userId: actorUserId,
      organizationId: employee.organizationId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeePayrollStatutoryOverride",
      entityId: employee.id,
      description: `Damien Leach PAYE set to ${PAYE.toFixed(2)} for ${open.length} period(s) after August through contract/year end.`,
      newValues: {
        payeAmount: PAYE,
        appliedPeriodEnds: open.map(isoDate),
        skippedPostedPeriodEnds: skippedPosted.map(isoDate),
        projectionEndDate: isoDate(projectionEndDate),
      },
    });
  });

  await recalculateAfterTaxChange({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    taxYear: TAX_YEAR,
    actorUserId,
    reason: "Damien PAYE corrected to 4289 after August",
    skipProjectionRefresh: true,
  });

  const rows = await prisma.employeePayrollStatutoryOverride.findMany({
    where: { employeeId: employee.id, taxYear: TAX_YEAR },
    orderBy: { periodEnd: "asc" },
    select: { periodEnd: true, payeAmount: true, status: true },
  });
  console.log("\nDamien 2026 overrides:");
  for (const row of rows) {
    console.log(
      `  ${isoDate(row.periodEnd)}  ${row.payeAmount?.toString()}  ${row.status}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
