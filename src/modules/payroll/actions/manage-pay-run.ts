"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { buildMonthlyPeriodBounds } from "@/src/modules/payroll/lib/pay-period";
import {
  aggregatePayRunTotals,
  buildEmployeePayRunSnapshot,
  toPayslipCreateData,
  toPayslipRecalcUpdateData,
  type PayRunEmployeeSnapshot,
} from "@/src/modules/payroll/lib/build-pay-run-snapshots";
import {
  aggregateIncludedPayRunTotals,
  filterIncludedPayRunRows,
  normalizeExclusionReason,
  type PayRunMembershipStatus,
} from "@/src/modules/payroll/lib/pay-run-membership";
import { planPeriodAfterDraftPayRunDelete } from "@/src/modules/payroll/lib/pay-run-delete";
import {
  findEmployeesBlockedFromPayRun,
  formatBlockedEmployees,
} from "@/src/modules/payroll/lib/pay-run-readiness-gate";

export type PayRunFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function decimalNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function payRunTotalsFromMembership(
  payslips: Array<{
    status: PayRunMembershipStatus;
    grossPay: { toString(): string };
    totalDeductions: { toString(): string };
    netPay: { toString(): string };
  }>,
) {
  return aggregateIncludedPayRunTotals(
    payslips.map((slip) => ({
      status: slip.status,
      grossPay: decimalNumber(slip.grossPay),
      totalDeductions: decimalNumber(slip.totalDeductions),
      netPay: decimalNumber(slip.netPay),
    })),
  );
}

async function applyPayRunTotals(
  transaction: Prisma.TransactionClient,
  payRunId: string,
  payslips: Array<{
    status: PayRunMembershipStatus;
    grossPay: { toString(): string };
    totalDeductions: { toString(): string };
    netPay: { toString(): string };
  }>,
) {
  const totals = payRunTotalsFromMembership(payslips);

  await transaction.payRun.update({
    where: { id: payRunId },
    data: {
      employeeCount: totals.employeeCount,
      totalGross: new Prisma.Decimal(totals.totalGross),
      totalDeductions: new Prisma.Decimal(totals.totalDeductions),
      totalNet: new Prisma.Decimal(totals.totalNet),
    },
  });

  return totals;
}

function revalidatePayRunPaths(payRunId: string) {
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${payRunId}`);
  revalidatePath(`/payroll/runs/${payRunId}/print`);
  revalidatePath("/me");
}

async function resolveOrganizationId() {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, defaultCurrency: true },
  });

  if (!organization) {
    throw new Error("No organization is configured.");
  }

  return organization;
}

async function allocatePayRunNumber(
  transaction: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  const sequence = await transaction.numberingSequence.findFirst({
    where: {
      organizationId,
      sequenceCode: "PAY_RUN",
      isActive: true,
    },
  });

  if (!sequence) {
    throw new Error("The PAY_RUN numbering sequence is not configured.");
  }

  const updatedSequence = await transaction.numberingSequence.update({
    where: { id: sequence.id },
    data: {
      currentNumber: { increment: 1 },
      version: { increment: 1 },
    },
  });

  const numberPart = updatedSequence.currentNumber
    .toString()
    .padStart(updatedSequence.minimumLength, "0");

  return `${updatedSequence.prefix ?? ""}${numberPart}${updatedSequence.suffix ?? ""}`;
}

async function collectReadyEmployeeSnapshots(
  asOf: Date,
): Promise<
  | { ok: true; rows: PayRunEmployeeSnapshot[] }
  | { ok: false; message: string }
> {
  const readiness = await getPayrollReadiness();
  const readyRows = readiness.rows.filter((row) => row.isReady);

  if (readyRows.length === 0) {
    return {
      ok: false,
      message:
        "No payroll-ready employees to include. Complete payroll setup before creating a pay run.",
    };
  }

  const snapshots: PayRunEmployeeSnapshot[] = [];
  const notReadyAtCalc: string[] = [];

  for (const row of readyRows) {
    const snapshot = await buildEmployeePayRunSnapshot(row.employeeId, asOf);

    if (!snapshot) {
      notReadyAtCalc.push(
        `${row.displayName} (${row.employeeNumber}): employee record not found.`,
      );
      continue;
    }

    if (!snapshot.isReady) {
      notReadyAtCalc.push(
        `${snapshot.employeeName} (${snapshot.employeeNumber}): ${
          snapshot.blockingIssues.join(" ") || "Not payroll-ready."
        }`,
      );
      continue;
    }

    snapshots.push(snapshot);
  }

  if (notReadyAtCalc.length > 0) {
    return {
      ok: false,
      message: formatBlockedEmployees(
        notReadyAtCalc,
        "Cannot include employees who are not payroll-ready:",
      ),
    };
  }

  if (snapshots.length === 0) {
    return {
      ok: false,
      message: "No payroll-ready employees produced a valid payslip snapshot.",
    };
  }

  return { ok: true, rows: snapshots };
}

export async function createMonthlyPayPeriod(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const periodKey = textValue(formData, "periodKey");
  const bounds = buildMonthlyPeriodBounds(periodKey);
  const fieldErrors: Record<string, string> = {};

  if (!bounds) {
    fieldErrors.periodKey = "Enter a valid month as YYYY-MM.";
  }

  if (Object.keys(fieldErrors).length > 0 || !bounds) {
    return {
      status: "error",
      message: "Review the pay period details.",
      fieldErrors,
    };
  }

  const organization = await resolveOrganizationId();

  const existing = await prisma.payrollPeriod.findUnique({
    where: {
      organizationId_periodKey_frequency: {
        organizationId: organization.id,
        periodKey: bounds.periodKey,
        frequency: "MONTHLY",
      },
    },
    select: { id: true },
  });

  if (existing) {
    return {
      status: "error",
      message: `A ${bounds.name} payroll period already exists.`,
      fieldErrors: { periodKey: "This period already exists." },
    };
  }

  const collected = await collectReadyEmployeeSnapshots(bounds.asOf);

  if (!collected.ok) {
    return { status: "error", message: collected.message };
  }

  const totals = aggregatePayRunTotals(collected.rows);
  const notes = nullableText(formData, "notes");
  const metadata = await getAuditRequestMetadata(formData);

  let payRunId = "";

  try {
    payRunId = await prisma.$transaction(async (transaction) => {
      const period = await transaction.payrollPeriod.create({
        data: {
          organizationId: organization.id,
          name: bounds.name,
          year: bounds.year,
          month: bounds.month,
          frequency: "MONTHLY",
          periodKey: bounds.periodKey,
          periodStart: bounds.periodStart,
          periodEnd: bounds.periodEnd,
          status: "OPEN",
          notes,
          createdById: actor.actor.userId,
        },
      });

      const runNumber = await allocatePayRunNumber(
        transaction,
        organization.id,
      );

      const payRun = await transaction.payRun.create({
        data: {
          organizationId: organization.id,
          payrollPeriodId: period.id,
          runNumber,
          status: "DRAFT",
          runKind: "REGULAR",
          currency: organization.defaultCurrency || "TTD",
          employeeCount: totals.employeeCount,
          totalGross: new Prisma.Decimal(totals.totalGross),
          totalDeductions: new Prisma.Decimal(totals.totalDeductions),
          totalNet: new Prisma.Decimal(totals.totalNet),
          notes,
          createdById: actor.actor.userId,
        },
      });

      await transaction.payslip.createMany({
        data: collected.rows.map((row) =>
          toPayslipCreateData({
            organizationId: organization.id,
            payRunId: payRun.id,
            payrollPeriodId: period.id,
            row,
            status: "DRAFT",
          }),
        ),
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "CREATE",
          entityType: "PayRun",
          entityId: payRun.id,
          description: `Created draft pay run ${runNumber} for ${bounds.name} with ${totals.employeeCount} employees.`,
          newValues: {
            runNumber,
            periodKey: bounds.periodKey,
            employeeCount: totals.employeeCount,
            totalNet: totals.totalNet,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return payRun.id;
    });
  } catch (error) {
    console.error("createMonthlyPayPeriod failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not create the payroll period.",
    };
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  redirect(`/payroll/runs/${payRunId}`);
}

/**
 * Create a CORRECTION or OFF_CYCLE draft on an already-posted period.
 * Does not modify the source posted run — new run with its own payslips.
 */
export async function createSupplementalPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const sourcePayRunId = textValue(formData, "sourcePayRunId");
  const runKindRaw = textValue(formData, "runKind").toUpperCase();
  const notes = nullableText(formData, "notes");
  const employeeIds = formData
    .getAll("employeeIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const fieldErrors: Record<string, string> = {};

  if (runKindRaw !== "CORRECTION" && runKindRaw !== "OFF_CYCLE") {
    fieldErrors.runKind = "Choose Correction or Off-cycle.";
  }

  if (employeeIds.length === 0) {
    fieldErrors.employeeIds = "Select at least one employee.";
  }

  if (!sourcePayRunId) {
    fieldErrors.sourcePayRunId = "Source pay run is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the correction / off-cycle details.",
      fieldErrors,
    };
  }

  const runKind = runKindRaw as "CORRECTION" | "OFF_CYCLE";

  const source = await prisma.payRun.findUnique({
    where: { id: sourcePayRunId },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodKey: true,
          periodEnd: true,
          status: true,
        },
      },
    },
  });

  if (!source) {
    return { status: "error", message: "Source pay run not found." };
  }

  if (source.status !== "POSTED") {
    return {
      status: "error",
      message:
        "Correction and off-cycle runs can only be created from a posted pay run.",
    };
  }

  const uniqueEmployeeIds = [...new Set(employeeIds)];
  const readiness = await getPayrollReadiness();
  const readyById = new Map(
    readiness.rows.map((row) => [row.employeeId, row]),
  );

  const snapshots: PayRunEmployeeSnapshot[] = [];
  const blocked: string[] = [];

  for (const employeeId of uniqueEmployeeIds) {
    const ready = readyById.get(employeeId);

    if (!ready?.isReady) {
      blocked.push(
        ready
          ? `${ready.displayName} (${ready.employeeNumber}): ${
              ready.blockingIssues.join(" ") || "Not payroll-ready."
            }`
          : `Unknown employee (${employeeId}).`,
      );
      continue;
    }

    const snapshot = await buildEmployeePayRunSnapshot(
      employeeId,
      source.payrollPeriod.periodEnd,
    );

    if (!snapshot || !snapshot.isReady) {
      blocked.push(
        `${ready.displayName} (${ready.employeeNumber}): ${
          snapshot?.blockingIssues.join(" ") ||
          "Could not calculate payslip snapshot."
        }`,
      );
      continue;
    }

    snapshots.push(snapshot);
  }

  if (blocked.length > 0) {
    return {
      status: "error",
      message: formatBlockedEmployees(
        blocked,
        "Cannot include employees who are not payroll-ready:",
      ),
    };
  }

  if (snapshots.length === 0) {
    return {
      status: "error",
      message: "No valid employee snapshots for this supplemental run.",
    };
  }

  const totals = aggregatePayRunTotals(snapshots);
  const organization = await resolveOrganizationId();
  const metadata = await getAuditRequestMetadata(formData);
  const kindLabel = runKind === "CORRECTION" ? "correction" : "off-cycle";

  let payRunId = "";

  try {
    payRunId = await prisma.$transaction(async (transaction) => {
      const runNumber = await allocatePayRunNumber(
        transaction,
        organization.id,
      );

      const payRun = await transaction.payRun.create({
        data: {
          organizationId: organization.id,
          payrollPeriodId: source.payrollPeriodId,
          runNumber,
          status: "DRAFT",
          runKind,
          sourcePayRunId: source.id,
          currency: source.currency || organization.defaultCurrency || "TTD",
          employeeCount: totals.employeeCount,
          totalGross: new Prisma.Decimal(totals.totalGross),
          totalDeductions: new Prisma.Decimal(totals.totalDeductions),
          totalNet: new Prisma.Decimal(totals.totalNet),
          notes,
          createdById: actor.actor.userId,
        },
      });

      await transaction.payslip.createMany({
        data: snapshots.map((row) =>
          toPayslipCreateData({
            organizationId: organization.id,
            payRunId: payRun.id,
            payrollPeriodId: source.payrollPeriodId,
            row,
            status: "DRAFT",
          }),
        ),
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "CREATE",
          entityType: "PayRun",
          entityId: payRun.id,
          description: `Created ${kindLabel} draft pay run ${runNumber} for ${source.payrollPeriod.name} (${totals.employeeCount} employees), sourced from ${source.runNumber}.`,
          newValues: {
            runNumber,
            runKind,
            sourcePayRunId: source.id,
            periodKey: source.payrollPeriod.periodKey,
            employeeCount: totals.employeeCount,
            totalNet: totals.totalNet,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return payRun.id;
    });
  } catch (error) {
    console.error("createSupplementalPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not create the supplemental pay run.",
    };
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${source.id}`);
  redirect(`/payroll/runs/${payRunId}`);
}

export async function excludePayslipFromPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");
  const payslipId = textValue(formData, "payslipId");
  const reason = normalizeExclusionReason(
    textValue(formData, "exclusionReason"),
  );

  if (!payRunId || !payslipId) {
    return { status: "error", message: "Pay run and payslip are required." };
  }

  if (!reason) {
    return {
      status: "error",
      message: "Enter a reason for excluding this employee.",
      fieldErrors: { exclusionReason: "Reason is required." },
    };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payslips: {
        select: {
          id: true,
          status: true,
          employeeId: true,
          employeeNumber: true,
          employeeName: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      },
    },
  });

  if (!payRun) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message: "Employees can only be excluded from draft pay runs.",
    };
  }

  const payslip = payRun.payslips.find((row) => row.id === payslipId);

  if (!payslip) {
    return { status: "error", message: "Payslip not found on this pay run." };
  }

  if (payslip.status === "EXCLUDED") {
    return {
      status: "error",
      message: "This employee is already excluded from the pay run.",
    };
  }

  if (payslip.status !== "DRAFT") {
    return {
      status: "error",
      message: "Only draft payslips can be excluded.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const excludedAt = new Date();

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.payslip.update({
        where: { id: payslip.id },
        data: {
          status: "EXCLUDED",
          excludedAt,
          excludedByUserId: actor.actor.userId,
          exclusionReason: reason,
        },
      });

      const refreshed = payRun.payslips.map((row) =>
        row.id === payslip.id
          ? { ...row, status: "EXCLUDED" as const }
          : row,
      );
      const totals = await applyPayRunTotals(
        transaction,
        payRun.id,
        refreshed,
      );

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "Payslip",
          entityId: payslip.id,
          description: `Excluded ${payslip.employeeName} (${payslip.employeeNumber}) from draft pay run ${payRun.runNumber}: ${reason}`,
          oldValues: { status: "DRAFT", exclusionReason: null },
          newValues: {
            status: "EXCLUDED",
            exclusionReason: reason,
            excludedAt: excludedAt.toISOString(),
            payRunId: payRun.id,
            employeeCount: totals.employeeCount,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    console.error("excludePayslipFromPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not exclude the employee.",
    };
  }

  revalidatePayRunPaths(payRun.id);
  return {
    status: "success",
    message: `${payslip.employeeName} excluded from this pay run.`,
  };
}

export async function reincludePayslipInPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");
  const payslipId = textValue(formData, "payslipId");

  if (!payRunId || !payslipId) {
    return { status: "error", message: "Pay run and payslip are required." };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payslips: {
        select: {
          id: true,
          status: true,
          employeeNumber: true,
          employeeName: true,
          exclusionReason: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      },
    },
  });

  if (!payRun) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message: "Employees can only be re-included on draft pay runs.",
    };
  }

  const payslip = payRun.payslips.find((row) => row.id === payslipId);

  if (!payslip) {
    return { status: "error", message: "Payslip not found on this pay run." };
  }

  if (payslip.status !== "EXCLUDED") {
    return {
      status: "error",
      message: "This employee is not excluded from the pay run.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.payslip.update({
        where: { id: payslip.id },
        data: {
          status: "DRAFT",
          excludedAt: null,
          excludedByUserId: null,
          exclusionReason: null,
        },
      });

      const refreshed = payRun.payslips.map((row) =>
        row.id === payslip.id ? { ...row, status: "DRAFT" as const } : row,
      );
      const totals = await applyPayRunTotals(
        transaction,
        payRun.id,
        refreshed,
      );

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "Payslip",
          entityId: payslip.id,
          description: `Re-included ${payslip.employeeName} (${payslip.employeeNumber}) on draft pay run ${payRun.runNumber}.`,
          oldValues: {
            status: "EXCLUDED",
            exclusionReason: payslip.exclusionReason,
          },
          newValues: {
            status: "DRAFT",
            exclusionReason: null,
            payRunId: payRun.id,
            employeeCount: totals.employeeCount,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    console.error("reincludePayslipInPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not re-include the employee.",
    };
  }

  revalidatePayRunPaths(payRun.id);
  return {
    status: "success",
    message: `${payslip.employeeName} re-included in this pay run.`,
  };
}

export async function recalculateDraftPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");

  if (!payRunId) {
    return { status: "error", message: "Pay run is required." };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodEnd: true,
        },
      },
      payslips: {
        select: {
          id: true,
          status: true,
          employeeId: true,
          employeeNumber: true,
          employeeName: true,
          exclusionReason: true,
          excludedAt: true,
          excludedByUserId: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      },
    },
  });

  if (!payRun) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message: "Only draft pay runs can be recalculated.",
    };
  }

  const included = filterIncludedPayRunRows(payRun.payslips);

  if (included.length === 0) {
    return {
      status: "error",
      message:
        "No included employees to recalculate. Re-include someone first, or create a new run.",
    };
  }

  const asOf = payRun.payrollPeriod.periodEnd;
  const snapshots: Array<{ payslipId: string; row: PayRunEmployeeSnapshot }> =
    [];
  const notReadyAtCalc: string[] = [];

  for (const slip of included) {
    const snapshot = await buildEmployeePayRunSnapshot(slip.employeeId, asOf);

    if (!snapshot) {
      notReadyAtCalc.push(
        `${slip.employeeName} (${slip.employeeNumber}): employee record not found.`,
      );
      continue;
    }

    if (!snapshot.isReady) {
      notReadyAtCalc.push(
        `${snapshot.employeeName} (${snapshot.employeeNumber}): ${
          snapshot.blockingIssues.join(" ") || "Not payroll-ready."
        }`,
      );
      continue;
    }

    snapshots.push({ payslipId: slip.id, row: snapshot });
  }

  if (notReadyAtCalc.length > 0) {
    return {
      status: "error",
      message: formatBlockedEmployees(
        notReadyAtCalc,
        "Cannot recalculate — some included employees are not payroll-ready:",
      ),
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const excludedCount = payRun.payslips.length - included.length;

  try {
    await prisma.$transaction(async (transaction) => {
      for (const entry of snapshots) {
        await transaction.payslip.update({
          where: { id: entry.payslipId },
          data: toPayslipRecalcUpdateData(entry.row),
        });
      }

      const amountRows = payRun.payslips.map((slip) => {
        const refreshed = snapshots.find(
          (entry) => entry.payslipId === slip.id,
        );
        if (refreshed) {
          return {
            status: slip.status,
            grossPay: refreshed.row.grossPay,
            totalDeductions: refreshed.row.totalDeductions,
            netPay: refreshed.row.netPay,
          };
        }
        return {
          status: slip.status,
          grossPay: decimalNumber(slip.grossPay),
          totalDeductions: decimalNumber(slip.totalDeductions),
          netPay: decimalNumber(slip.netPay),
        };
      });

      const totals = aggregateIncludedPayRunTotals(amountRows);

      await transaction.payRun.update({
        where: { id: payRun.id },
        data: {
          employeeCount: totals.employeeCount,
          totalGross: new Prisma.Decimal(totals.totalGross),
          totalDeductions: new Prisma.Decimal(totals.totalDeductions),
          totalNet: new Prisma.Decimal(totals.totalNet),
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "PayRun",
          entityId: payRun.id,
          description: `Recalculated draft pay run ${payRun.runNumber} for ${totals.employeeCount} included employees${
            excludedCount > 0
              ? ` (${excludedCount} excluded preserved)`
              : ""
          }.`,
          newValues: {
            employeeCount: totals.employeeCount,
            excludedCount,
            totalNet: totals.totalNet,
            totalGross: totals.totalGross,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    console.error("recalculateDraftPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not recalculate the pay run.",
    };
  }

  revalidatePayRunPaths(payRun.id);
  return {
    status: "success",
    message: `Recalculated ${snapshots.length} included employee${
      snapshots.length === 1 ? "" : "s"
    } from current contracts and statutory configs.${
      excludedCount > 0
        ? ` ${excludedCount} excluded employee${excludedCount === 1 ? "" : "s"} left unchanged.`
        : ""
    }`,
  };
}

export async function postPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");

  if (!payRunId) {
    return { status: "error", message: "Pay run is required." };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodKey: true,
          periodEnd: true,
        },
      },
      payslips: {
        select: {
          id: true,
          employeeId: true,
          employeeNumber: true,
          employeeName: true,
          status: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      },
    },
  });

  if (!payRun) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message: "Only draft pay runs can be posted.",
    };
  }

  const includedPayslips = filterIncludedPayRunRows(payRun.payslips);

  if (includedPayslips.length === 0) {
    return {
      status: "error",
      message:
        "This pay run has no included employees to post. Re-include someone first.",
    };
  }

  // Readiness gate at post time — refuse if any included employee is no longer ready.
  const readiness = await getPayrollReadiness();
  const readyById = new Map(
    readiness.rows.map((row) => [
      row.employeeId,
      {
        isReady: row.isReady,
        blockingIssues: row.blockingIssues,
      },
    ]),
  );
  const blocked = findEmployeesBlockedFromPayRun(
    includedPayslips.map((slip) => ({
      employeeId: slip.employeeId,
      employeeNumber: slip.employeeNumber,
      employeeName: slip.employeeName,
    })),
    readyById,
  );

  if (blocked.length > 0) {
    return {
      status: "error",
      message: formatBlockedEmployees(
        blocked,
        "Cannot post — some included employees are no longer payroll-ready:",
      ),
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const postedAt = new Date();
  const totals = payRunTotalsFromMembership(payRun.payslips);
  const excludedCount = payRun.payslips.length - includedPayslips.length;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.payslip.updateMany({
        where: {
          payRunId: payRun.id,
          status: "DRAFT",
        },
        data: { status: "POSTED" },
      });

      await transaction.payRun.update({
        where: { id: payRun.id },
        data: {
          status: "POSTED",
          postedAt,
          postedById: actor.actor.userId,
          employeeCount: totals.employeeCount,
          totalGross: new Prisma.Decimal(totals.totalGross),
          totalDeductions: new Prisma.Decimal(totals.totalDeductions),
          totalNet: new Prisma.Decimal(totals.totalNet),
        },
      });

      await transaction.payrollPeriod.update({
        where: { id: payRun.payrollPeriodId },
        data: { status: "CLOSED" },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "PayRun",
          entityId: payRun.id,
          description: `Posted pay run ${payRun.runNumber} for ${payRun.payrollPeriod.name} (${totals.employeeCount} employees${
            excludedCount > 0 ? `, ${excludedCount} excluded` : ""
          }). Amounts are frozen.`,
          oldValues: { status: "DRAFT" },
          newValues: {
            status: "POSTED",
            postedAt: postedAt.toISOString(),
            employeeCount: totals.employeeCount,
            excludedCount,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    console.error("postPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not post the pay run.",
    };
  }

  revalidatePayRunPaths(payRun.id);
  redirect(`/payroll/runs/${payRun.id}`);
}

export async function deleteDraftPayRun(
  _previousState: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");

  if (!payRunId) {
    return { status: "error", message: "Pay run is required." };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodKey: true,
          status: true,
        },
      },
      _count: {
        select: { payslips: true },
      },
    },
  });

  if (!payRun) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message:
        "Posted pay runs cannot be deleted. Posted payroll history is immutable.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const runNumber = payRun.runNumber;
  const periodName = payRun.payrollPeriod.name;
  const periodKey = payRun.payrollPeriod.periodKey;
  const payslipCount = payRun._count.payslips;

  try {
    await prisma.$transaction(async (transaction) => {
      const remainingPayRunCount = await transaction.payRun.count({
        where: {
          payrollPeriodId: payRun.payrollPeriodId,
          id: { not: payRun.id },
        },
      });
      const remainingPostedCount = await transaction.payRun.count({
        where: {
          payrollPeriodId: payRun.payrollPeriodId,
          id: { not: payRun.id },
          status: "POSTED",
        },
      });

      const periodPlan = planPeriodAfterDraftPayRunDelete({
        periodId: payRun.payrollPeriodId,
        periodStatus: payRun.payrollPeriod.status,
        remainingPayRunCount,
        remainingPostedCount,
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "payroll",
          action: "DELETE",
          entityType: "PayRun",
          entityId: payRun.id,
          description: `Deleted draft pay run ${runNumber} for ${periodName} (${payslipCount} payslip${
            payslipCount === 1 ? "" : "s"
          }).`,
          oldValues: {
            runNumber,
            status: "DRAFT",
            periodKey,
            periodName,
            periodStatus: payRun.payrollPeriod.status,
            payslipCount,
            periodPlan: periodPlan.action,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      // Payslips cascade via payRunId (including EXCLUDED membership rows).
      await transaction.payRun.delete({
        where: { id: payRun.id },
      });

      if (periodPlan.action === "delete_period") {
        await transaction.payrollPeriod.delete({
          where: { id: periodPlan.periodId },
        });
      } else if (periodPlan.action === "reopen_period") {
        await transaction.payrollPeriod.update({
          where: { id: periodPlan.periodId },
          data: { status: "OPEN" },
        });
      }
    });
  } catch (error) {
    console.error("deleteDraftPayRun failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not delete the draft pay run.",
    };
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${payRunId}`);
  revalidatePath(`/payroll/runs/${payRunId}/print`);
  revalidatePath("/me");
  redirect(
    `/payroll/runs?deleted=${encodeURIComponent(runNumber)}`,
  );
}
