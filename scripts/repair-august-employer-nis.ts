/**
 * Rebuild a posted August 2026 payslip snapshot so Class Z employer NIS
 * appears on the payroll register when eligible.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/repair-august-employer-nis.ts Ursula
 *   npx tsx --env-file=.env scripts/repair-august-employer-nis.ts --employee-number=12 --dry-run
 */

import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  buildEmployeePayRunSnapshot,
  toPayslipRecalcUpdateData,
} from "../src/modules/payroll/lib/build-pay-run-snapshots";
import { extractEmployerNisFromSnapshot } from "../src/modules/payroll/lib/statutory-remittance";
import { recordAuditEvent } from "../src/modules/audit/services/record-audit-event";

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const employeeNumberArg = process.argv.find((arg) =>
    arg.startsWith("--employee-number="),
  );
  const employeeNumber = employeeNumberArg?.split("=")[1];
  const nameQuery = process.argv
    .slice(2)
    .find(
      (arg) =>
        !arg.startsWith("-") &&
        !arg.endsWith(".ts") &&
        !arg.includes("/") &&
        !arg.includes("\\"),
    );

  return { dryRun, employeeNumber, nameQuery };
}

async function resolveEmployee(input: {
  employeeNumber?: string;
  nameQuery?: string;
}) {
  if (input.employeeNumber) {
    return prisma.employee.findFirst({
      where: { employeeNumber: input.employeeNumber, isArchived: false },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        organizationId: true,
        payrollProfile: {
          select: { exemptFromNis: true, receivingNisRetirementBenefit: true },
        },
      },
    });
  }

  if (!input.nameQuery) {
    throw new Error("Pass an employee name or --employee-number=NN.");
  }

  return prisma.employee.findFirst({
    where: {
      isArchived: false,
      OR: [
        { firstName: { contains: input.nameQuery, mode: "insensitive" } },
        { lastName: { contains: input.nameQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      organizationId: true,
      payrollProfile: {
        select: { exemptFromNis: true, receivingNisRetirementBenefit: true },
      },
    },
  });
}

async function main() {
  const { dryRun, employeeNumber, nameQuery } = parseArgs();
  const employee = await resolveEmployee({ employeeNumber, nameQuery });
  if (!employee) {
    throw new Error(
      employeeNumber
        ? `Employee #${employeeNumber} not found.`
        : `No employee matched "${nameQuery}".`,
    );
  }

  const slip = await prisma.payslip.findFirst({
    where: {
      employeeId: employee.id,
      payrollPeriod: { periodKey: "2026-08" },
    },
    select: {
      id: true,
      status: true,
      nisEmployeeAmount: true,
      snapshot: true,
      payRun: {
        select: { id: true, runNumber: true, status: true },
      },
      payrollPeriod: {
        select: { periodStart: true, periodEnd: true, name: true },
      },
    },
  });
  if (!slip) {
    throw new Error(
      `August 2026 payslip not found for ${employee.firstName} ${employee.lastName}.`,
    );
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
  const delta = afterEmployer - beforeEmployer;

  console.log(
    `#${employee.employeeNumber} ${employee.firstName} ${employee.lastName}`,
  );
  console.log(`DOB: ${employee.dateOfBirth?.toISOString().slice(0, 10) ?? "—"}`);
  console.log(
    `NIS exempt: ${employee.payrollProfile?.exemptFromNis ?? false} · retirement benefit: ${employee.payrollProfile?.receivingNisRetirementBenefit ?? false}`,
  );
  console.log(`${slip.payrollPeriod.name} · ${slip.payRun.runNumber} (${slip.status})`);
  console.log(`Employee NIS: ${Number(slip.nisEmployeeAmount ?? 0).toFixed(2)}`);
  console.log(`Employer NIS before: ${beforeEmployer.toFixed(2)}`);
  console.log(`Employer NIS after:  ${afterEmployer.toFixed(2)}`);
  console.log(
    delta === 0
      ? "Change: none"
      : `Change: ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`,
  );
  console.log("Employer lines:", rebuilt.snapshot.payslip.employerContributions);
  console.log("NIS calc:", rebuilt.snapshot.payslip.nis);

  if (afterEmployer <= 0 && beforeEmployer <= 0) {
    console.log("\nNo employer NIS produced — nothing to update.");
    return;
  }

  if (dryRun) {
    console.log("\nDry run — no database changes.");
    return;
  }

  if (delta === 0 && beforeEmployer > 0) {
    console.log("\nEmployer NIS unchanged — snapshot not rewritten.");
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
        description: `Rebuilt August 2026 payslip snapshot for ${employee.firstName} ${employee.lastName} — employer NIS ${beforeEmployer.toFixed(2)} → ${afterEmployer.toFixed(2)}.`,
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
