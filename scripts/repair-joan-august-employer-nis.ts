/**
 * Rebuild Joan Paulson-Wilson (#11) August 2026 posted payslip snapshot so
 * Class Z employer NIS appears on the payroll register / paysheet.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/repair-joan-august-employer-nis.ts
 *   npx tsx --env-file=.env scripts/repair-joan-august-employer-nis.ts --dry-run
 */

import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  buildEmployeePayRunSnapshot,
  toPayslipRecalcUpdateData,
} from "../src/modules/payroll/lib/build-pay-run-snapshots";
import { extractEmployerNisFromSnapshot } from "../src/modules/payroll/lib/statutory-remittance";
import { recordAuditEvent } from "../src/modules/audit/services/record-audit-event";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const employee = await prisma.employee.findFirst({
    where: { employeeNumber: "11" },
    select: { id: true, firstName: true, lastName: true, organizationId: true },
  });
  if (!employee) {
    throw new Error("Joan Paulson-Wilson (#11) not found.");
  }

  const slip = await prisma.payslip.findFirst({
    where: {
      employeeId: employee.id,
      payrollPeriod: { periodKey: "2026-08" },
    },
    select: {
      id: true,
      status: true,
      snapshot: true,
      payRun: {
        select: {
          id: true,
          runNumber: true,
          status: true,
        },
      },
      payrollPeriod: {
        select: {
          periodStart: true,
          periodEnd: true,
          name: true,
        },
      },
    },
  });
  if (!slip) {
    throw new Error("August 2026 payslip not found for Joan.");
  }

  const beforeEmployer = extractEmployerNisFromSnapshot(slip.snapshot);
  const rebuilt = await buildEmployeePayRunSnapshot(
    employee.id,
    slip.payrollPeriod.periodEnd,
    {
      periodStart: slip.payrollPeriod.periodStart,
      periodEnd: slip.payrollPeriod.periodEnd,
    },
  );
  if (!rebuilt) {
    throw new Error("Could not rebuild payslip snapshot.");
  }

  const afterEmployer = extractEmployerNisFromSnapshot(rebuilt.snapshot);

  console.log(
    `${employee.firstName} ${employee.lastName} — ${slip.payrollPeriod.name}`,
  );
  console.log(`Pay run: ${slip.payRun.runNumber} (${slip.payRun.status})`);
  console.log(`Payslip status: ${slip.status}`);
  console.log(`Employer NIS before: ${beforeEmployer.toFixed(2)}`);
  console.log(`Employer NIS after:  ${afterEmployer.toFixed(2)}`);
  console.log(
    "Employer lines:",
    rebuilt.snapshot.payslip.employerContributions,
  );

  if (afterEmployer <= 0) {
    throw new Error("Rebuild did not produce an employer NIS amount.");
  }

  if (dryRun) {
    console.log("\nDry run — no database changes.");
    return;
  }

  const actorUserId =
    (
      await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id ?? null;

  await prisma.$transaction(async (transaction) => {
    await transaction.payslip.update({
      where: { id: slip.id },
      data: toPayslipRecalcUpdateData(rebuilt),
    });

    if (actorUserId) {
      await recordAuditEvent(transaction, {
        userId: actorUserId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "Payslip",
        entityId: slip.id,
        description: `Rebuilt August 2026 payslip snapshot for ${employee.firstName} ${employee.lastName} to include Class Z employer NIS (${afterEmployer.toFixed(2)}).`,
        newValues: {
          employerNisBefore: beforeEmployer,
          employerNisAfter: afterEmployer,
          payRunId: slip.payRun.id,
        },
      });
    }
  });

  console.log("\nAugust payslip snapshot updated.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
