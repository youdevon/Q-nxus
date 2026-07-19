/**
 * Smoke checks for contract governance + lifecycle cancel.
 * Run: npx tsx scripts/smoke-hr-contract-spine.ts
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  cancelEmployeeOnboardingCase,
  openEmployeeOnboardingCase,
} from "../src/modules/hr/services/employee-lifecycle-cases";

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!org) throw new Error("No organization");

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
  if (!employee) throw new Error("No employee");

  const actor = await prisma.user.findFirst({
    where: { organizationId: org.id, isActive: true },
    select: { id: true },
  });
  if (!actor) throw new Error("No user");

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

  // Mark awaiting signature with dual signs, then activate via service path fields
  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: {
      status: "AWAITING_SIGNATURE",
      approvedAt: new Date(),
      approvedByUserId: actor.id,
      employeeSignedAt: new Date(),
      orgSignedAt: new Date(),
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
    select: { status: true, isCurrent: true, activatedAt: true },
  });
  const balanceCountActive = await prisma.employeeLeaveBalance.count({
    where: { contractId: draft.id },
  });

  console.log("activated", {
    ...activated,
    leaveBalances: balanceCountActive,
  });

  if (activated.status !== "ACTIVE" || !activated.isCurrent) {
    throw new Error("Activation failed");
  }

  // Cleanup smoke contract so it does not pollute monitoring permanently
  await prisma.employeeLeaveBalance.deleteMany({ where: { contractId: draft.id } });
  await prisma.leaveBalanceTransaction.deleteMany({
    where: { contractId: draft.id },
  });
  await prisma.employmentContract.update({
    where: { id: draft.id },
    data: { isCurrent: false, status: "CANCELLED" },
  });

  const opened = await openEmployeeOnboardingCase({
    organizationId: org.id,
    employeeId: employee.id,
    openedByUserId: actor.id,
    notes: "smoke open",
  });

  await cancelEmployeeOnboardingCase({
    caseId: opened.id,
    cancelledByUserId: actor.id,
    notes: "smoke cancel",
  });

  const cancelled = await prisma.employeeOnboardingCase.findUniqueOrThrow({
    where: { id: opened.id },
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
