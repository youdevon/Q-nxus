/**
 * Apply approved statutory PAYE overrides from the August 2026 in-house payroll
 * worksheet to every remaining open monthly period through contract / year-end.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/apply-august-sheet-paye-overrides.ts
 *   npx tsx --env-file=.env scripts/apply-august-sheet-paye-overrides.ts --dry-run
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
const REASON =
  "August 2026 in-house payroll worksheet — master PAYE applied to remaining open periods.";

/** Employee number → monthly PAYE from signed August 2026 salary register. */
const SHEET_PAYE_BY_EMPLOYEE_NUMBER: Record<string, number> = {
  "11": 4_847, // Joan Paulson-Wilson
  "15": 6_588, // Ryan Melville
  "16": 4_311, // Kemba Melville
  "17": 4_289, // Damien Leach
  "18": 3_136, // Keston Peterson
  "19": 2_797, // Devon Dumas
  "20": 2_704, // Kathy Ann Guy-Greene
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function resolveActorUserId(): Promise<string> {
  const fromProfile = await prisma.employeeTaxProfile.findFirst({
    where: { taxYear: TAX_YEAR },
    select: { createdByUserId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (fromProfile?.createdByUserId) {
    return fromProfile.createdByUserId;
  }

  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!user) {
    throw new Error("No user found for override audit fields.");
  }
  return user.id;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const actorUserId = await resolveActorUserId();

  const asOfDate = new Date(`${TAX_YEAR}-07-31T00:00:00.000Z`);
  const yearEnd = new Date(`${TAX_YEAR}-12-31T00:00:00.000Z`);

  const employeeNumbers = Object.keys(SHEET_PAYE_BY_EMPLOYEE_NUMBER);
  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      employeeNumber: { in: employeeNumbers },
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
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

  const missing = employeeNumbers.filter(
    (num) => !employees.some((e) => e.employeeNumber === num),
  );
  if (missing.length > 0) {
    console.warn("Missing employees for numbers:", missing.join(", "));
  }

  console.log(
    dryRun ? "DRY RUN — no writes\n" : "Applying statutory PAYE overrides…\n",
  );

  for (const employee of employees) {
    const payeAmount = SHEET_PAYE_BY_EMPLOYEE_NUMBER[employee.employeeNumber];
    if (payeAmount == null || payeAmount <= 0) {
      continue;
    }

    const contractEnd = employee.contracts[0]?.endDate ?? null;
    const employmentEnd = employee.terminationDate ?? contractEnd;
    let projectionEndDate = yearEnd;
    if (
      employmentEnd &&
      employmentEnd.getUTCFullYear() === TAX_YEAR &&
      employmentEnd.getTime() < yearEnd.getTime()
    ) {
      projectionEndDate = employmentEnd;
    }

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

    console.log(
      `#${employee.employeeNumber} ${employee.firstName} ${employee.lastName}`,
    );
    console.log(
      `  PAYE ${payeAmount.toFixed(2)} → ${open.length} period(s): ${open.map(isoDate).join(", ") || "(none)"}`,
    );
    if (skippedPosted.length > 0) {
      console.log(
        `  skipped posted: ${skippedPosted.map(isoDate).join(", ")}`,
      );
    }

    if (dryRun || open.length === 0) {
      continue;
    }

    const payeDecimal = new Prisma.Decimal(payeAmount.toFixed(2));

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
        description: `Applied August 2026 worksheet PAYE (${payeAmount.toFixed(2)}) to ${open.length} open period(s) for ${employee.firstName} ${employee.lastName}.`,
        newValues: {
          payeAmount,
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
      reason: "August 2026 worksheet PAYE overrides applied",
      skipProjectionRefresh: true,
    });
  }

  console.log(dryRun ? "\nDry run complete." : "\nDone.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
