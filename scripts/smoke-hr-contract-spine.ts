/**
 * Smoke checks for contract governance, leave overrides, rebuild, payroll
 * readiness after activate, and vacation forfeiture queue.
 * Run: npx tsx scripts/smoke-hr-contract-spine.ts
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  cancelEmployeeOnboardingCase,
  openEmployeeOnboardingCase,
} from "../src/modules/hr/services/employee-lifecycle-cases";
import { createContractLeaveBalances } from "../src/modules/hr/services/create-contract-leave-balances";
import { rebuildCurrentContractLeaveBalances } from "../src/modules/hr/services/rebuild-leave-balances";
import { syncPayrollReadinessAfterContractActivate } from "../src/modules/hr/services/sync-payroll-readiness-after-activate";
import { getVacationForfeitureQueue } from "../src/modules/hr/data/get-vacation-forfeiture-queue";
import { notifyVacationForfeitureReminders } from "../src/modules/hr/services/notify-vacation-forfeiture";

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!org) throw new Error("No organization — run seed first");

  const employee = await prisma.employee.findFirst({
    where: {
      organizationId: org.id,
      isArchived: false,
      workforceCategory: "EMPLOYEE",
    },
    select: {
      id: true,
      employeeNumber: true,
      hireDate: true,
      positionId: true,
      departmentId: true,
      position: { select: { title: true } },
    },
  });
  if (!employee) throw new Error("No employee — run seed first");

  const actor = await prisma.user.findFirst({
    where: { organizationId: org.id, isActive: true },
    select: { id: true },
  });
  if (!actor) throw new Error("No user — run seed first");

  // Temporarily clear current flag so activate can claim isCurrent; restore after.
  const priorCurrent = await prisma.employmentContract.findMany({
    where: { employeeId: employee.id, isCurrent: true },
    select: { id: true, status: true },
  });

  if (priorCurrent.length > 0) {
    await prisma.employmentContract.updateMany({
      where: { id: { in: priorCurrent.map((row) => row.id) } },
      data: { isCurrent: false },
    });
  }

  // Cancel any open onboarding so smoke gets a fresh ACTIVATE_CONTRACT task.
  const openCases = await prisma.employeeOnboardingCase.findMany({
    where: {
      employeeId: employee.id,
      status: { in: ["OPEN", "READY"] },
    },
    select: { id: true },
  });
  for (const openCase of openCases) {
    await cancelEmployeeOnboardingCase({
      caseId: openCase.id,
      cancelledByUserId: actor.id,
      notes: "smoke reset",
    });
  }

  const onboarding = await openEmployeeOnboardingCase({
    organizationId: org.id,
    employeeId: employee.id,
    openedByUserId: actor.id,
    notes: "smoke open before activate",
  });

  const end = new Date(employee.hireDate);
  end.setUTCFullYear(end.getUTCFullYear() + 1);

  const draft = await prisma.employmentContract.create({
    data: {
      employeeId: employee.id,
      contractType: "FIXED_TERM",
      changeType: "INITIAL",
      status: "DRAFT",
      startDate: employee.hireDate,
      endDate: end,
      jobTitle: employee.position?.title ?? "Smoke Test Role",
      baseSalary: 1000,
      currency: "TTD",
      isCurrent: false,
      positionId: employee.positionId,
      departmentId: employee.departmentId,
      contractNumber: `SMOKE-${Date.now()}`,
      vacationLeaveDaysOverride: 0,
      sickLeaveDaysOverride: 3,
    },
    select: { id: true, status: true, isCurrent: true },
  });

  const balanceCountDraft = await prisma.employeeLeaveBalance.count({
    where: { contractId: draft.id },
  });

  console.log("draft", {
    status: draft.status,
    isCurrent: draft.isCurrent,
    leaveBalances: balanceCountDraft,
  });

  if (draft.isCurrent || balanceCountDraft > 0) {
    throw new Error("Draft must not be current or create leave balances");
  }

  // Status path: APPROVED then first signature → AWAITING_SIGNATURE
  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: actor.id,
    },
  });

  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: {
      status: "AWAITING_SIGNATURE",
      employeeSignedAt: new Date(),
      orgSignedAt: new Date(),
      signedDate: new Date(),
    },
  });

  const { activateEmploymentContractInTransaction } = await import(
    "../src/modules/hr/services/activate-employment-contract"
  );

  await prisma.$transaction(async (tx) => {
    await activateEmploymentContractInTransaction(
      {
        contractId: draft.id,
        employeeId: employee.id,
        organizationId: org.id,
        actorUserId: actor.id,
        audit: {
          ipAddress: null,
          userAgent: null,
          clientHostName: null,
        },
        applyAssignment: false,
      },
      tx,
    );
  });

  const activated = await prisma.employmentContract.findUniqueOrThrow({
    where: { id: draft.id },
    select: {
      status: true,
      isCurrent: true,
      activatedAt: true,
      vacationLeaveDaysOverride: true,
      sickLeaveDaysOverride: true,
    },
  });

  const vacBalance = await prisma.employeeLeaveBalance.findFirst({
    where: {
      contractId: draft.id,
      leaveType: { code: "VAC" },
    },
    select: { entitlement: true },
  });
  const sickBalance = await prisma.employeeLeaveBalance.findFirst({
    where: {
      contractId: draft.id,
      leaveType: { code: "SICK" },
    },
    select: { entitlement: true },
  });

  console.log("activated", {
    status: activated.status,
    isCurrent: activated.isCurrent,
    vacationOverride: activated.vacationLeaveDaysOverride?.toString() ?? null,
    sickOverride: activated.sickLeaveDaysOverride?.toString() ?? null,
    vacEntitlement: vacBalance?.entitlement.toString() ?? null,
    sickEntitlement: sickBalance?.entitlement.toString() ?? null,
  });

  if (activated.status !== "ACTIVE" || !activated.isCurrent) {
    throw new Error("Activation failed");
  }

  if (vacBalance && Number(vacBalance.entitlement) !== 0) {
    throw new Error(
      `Expected VAC entitlement 0 from override, got ${vacBalance.entitlement}`,
    );
  }

  if (sickBalance && Number(sickBalance.entitlement) !== 3) {
    throw new Error(
      `Expected SICK entitlement 3 from override, got ${sickBalance.entitlement}`,
    );
  }

  const payrollSync = await syncPayrollReadinessAfterContractActivate({
    employeeId: employee.id,
    organizationId: org.id,
    actorUserId: actor.id,
    contractId: draft.id,
  });

  console.log("payrollSync", payrollSync);

  if (!payrollSync.activateTaskCompleted) {
    throw new Error(
      "Expected ACTIVATE_CONTRACT onboarding task to auto-complete after activate",
    );
  }

  const activateTask = await prisma.employeeOnboardingTask.findFirst({
    where: {
      caseId: onboarding.id,
      code: "ACTIVATE_CONTRACT",
    },
    select: { status: true },
  });

  if (activateTask?.status !== "COMPLETED") {
    throw new Error(
      `ACTIVATE_CONTRACT task status expected COMPLETED, got ${activateTask?.status}`,
    );
  }

  // Mid-contract entitlement change + rebuild must keep overrides
  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: { vacationLeaveDaysOverride: 7 },
  });

  await createContractLeaveBalances(draft.id, actor.id);

  const vacAfterEdit = await prisma.employeeLeaveBalance.findFirst({
    where: {
      contractId: draft.id,
      leaveType: { code: "VAC" },
    },
    select: { entitlement: true },
  });

  if (!vacAfterEdit || Number(vacAfterEdit.entitlement) !== 7) {
    throw new Error(
      `Expected VAC entitlement 7 after mid-contract edit, got ${vacAfterEdit?.entitlement}`,
    );
  }

  const rebuild = await rebuildCurrentContractLeaveBalances({
    organizationId: org.id,
    createdByUserId: actor.id,
  });

  const vacAfterRebuild = await prisma.employeeLeaveBalance.findFirst({
    where: {
      contractId: draft.id,
      leaveType: { code: "VAC" },
    },
    select: { entitlement: true },
  });

  console.log("rebuild", {
    ...rebuild,
    vacEntitlement: vacAfterRebuild?.entitlement.toString() ?? null,
  });

  if (!vacAfterRebuild || Number(vacAfterRebuild.entitlement) !== 7) {
    throw new Error(
      `Rebuild wiped VAC override; expected 7, got ${vacAfterRebuild?.entitlement}`,
    );
  }

  // Forfeiture queue: contract ends within 30 days + available VAC > 0
  const forfeitureEnd = new Date();
  forfeitureEnd.setUTCDate(forfeitureEnd.getUTCDate() + 15);
  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: { endDate: forfeitureEnd },
  });

  const queue = await getVacationForfeitureQueue(org.id, new Date(), 50);
  const inQueue = queue.find((item) => item.contractId === draft.id);

  console.log("forfeitureQueue", {
    size: queue.length,
    smokeInQueue: Boolean(inQueue),
    daysUntilEnd: inQueue?.daysUntilEnd ?? null,
    availableDays: inQueue?.availableDays ?? null,
  });

  if (!inQueue) {
    throw new Error(
      "Expected smoke contract in vacation forfeiture queue (15 days left, VAC>0)",
    );
  }

  if (inQueue.availableDays <= 0) {
    throw new Error("Forfeiture queue item must have availableDays > 0");
  }

  const notifyResult = await notifyVacationForfeitureReminders({
    employeeId: employee.id,
    asOf: new Date(),
  });

  console.log("forfeitureNotify", notifyResult);

  if (notifyResult.considered < 1) {
    throw new Error("Forfeiture notify considered 0 contracts for smoke employee");
  }

  // Cleanup smoke contract + related rows
  await prisma.leaveBalanceTransaction.deleteMany({
    where: { contractId: draft.id },
  });
  await prisma.employeeLeaveBalance.deleteMany({
    where: { contractId: draft.id },
  });
  await prisma.employmentContract.delete({ where: { id: draft.id } });

  // Restore prior current contracts (smoke only cleared isCurrent, not status).
  for (const prior of priorCurrent) {
    await prisma.employmentContract.update({
      where: { id: prior.id },
      data: { isCurrent: true },
    });
  }

  await cancelEmployeeOnboardingCase({
    caseId: onboarding.id,
    cancelledByUserId: actor.id,
    notes: "smoke cancel",
  });

  const cancelled = await prisma.employeeOnboardingCase.findUniqueOrThrow({
    where: { id: onboarding.id },
    select: {
      status: true,
      tasks: { select: { status: true } },
    },
  });

  console.log("onboarding cancel", {
    status: cancelled.status,
    pendingLeft: cancelled.tasks.filter((t) => t.status === "PENDING").length,
  });

  if (cancelled.status !== "CANCELLED") {
    throw new Error("Onboarding cancel failed");
  }

  console.log("SMOKE_OK");
}

main()
  .catch((error) => {
    console.error("SMOKE_FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
