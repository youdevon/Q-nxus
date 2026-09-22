/**
 * Forward-fill approved statutory overrides across open months according to
 * apply scope: this period only, through year end, or through contract end.
 */

import { Prisma } from "@/generated/prisma/client";
import type { StatutoryOverrideApplyScope } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import {
  resolveContinuousEmploymentEnd,
  shouldSkipPayeAutoApplyForPeriod,
  type EmploymentContractSpan,
} from "@/src/modules/payroll/lib/continuous-employment";
import {
  filterOpenPeriodEnds,
  listRemainingMonthlyPeriodEnds,
} from "@/src/modules/payroll/lib/remaining-payroll-periods";
import { taxYearFromAsOfKey, toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";

export type PropagateStickyPayeResult = {
  appliedPeriodEnds: string[];
  skippedPostedPeriodEnds: string[];
  skippedMidMonthPeriodEnds: string[];
  employmentEndDate: string | null;
  continuous: boolean;
  applyScope: StatutoryOverrideApplyScope;
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayBefore(value: Date): Date {
  const day = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 1),
  );
}

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return new Prisma.Decimal(Math.max(0, value).toFixed(2));
}

async function loadEmploymentContext(employeeId: string): Promise<{
  organizationId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  terminationDate: Date | null;
  hireDate: Date | null;
  contracts: EmploymentContractSpan[];
}> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      terminationDate: true,
      hireDate: true,
      contracts: {
        where: {
          status: { in: ["ACTIVE", "SUPERSEDED", "APPROVED"] },
        },
        orderBy: [{ startDate: "asc" }],
        select: {
          id: true,
          startDate: true,
          endDate: true,
          terminationDate: true,
          sourceContractId: true,
          status: true,
          isCurrent: true,
        },
      },
    },
  });
  if (!employee) {
    throw new Error("Employee not found.");
  }
  return {
    organizationId: employee.organizationId,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    terminationDate: employee.terminationDate,
    hireDate: employee.hireDate,
    contracts: employee.contracts,
  };
}

function resolveProjectionEnd(input: {
  applyScope: StatutoryOverrideApplyScope;
  taxYear: number;
  continuousEnd: Date | null;
}): Date {
  const yearEnd = new Date(Date.UTC(input.taxYear, 11, 31));

  if (input.applyScope === "THROUGH_CONTRACT_END" && input.continuousEnd) {
    const end = input.continuousEnd;
    if (end.getUTCFullYear() === input.taxYear) {
      return new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
      );
    }
  }

  // THROUGH_YEAR_END (and contract-end without a same-year date): tax-year end,
  // but never past continuous employment when that ends earlier in the year.
  if (
    input.continuousEnd &&
    input.continuousEnd.getUTCFullYear() === input.taxYear &&
    input.continuousEnd.getTime() < yearEnd.getTime()
  ) {
    return new Date(
      Date.UTC(
        input.continuousEnd.getUTCFullYear(),
        input.continuousEnd.getUTCMonth() + 1,
        0,
      ),
    );
  }

  return yearEnd;
}

/**
 * Upsert approved statutory overrides from `fromPeriodEnd` according to apply
 * scope. Mid-month final months are skipped for PAYE (caller may notify).
 */
export async function propagateStickyPayeOverrides(input: {
  employeeId: string;
  fromPeriodEnd: Date;
  payeAmount?: number | null;
  nisEmployeeAmount?: number | null;
  healthSurchargeAmount?: number | null;
  reason: string;
  actorUserId: string;
  metadata?: AuditRequestMetadata;
  /** When true, only update periods strictly after fromPeriodEnd. */
  excludeFromPeriod?: boolean;
  applyScope?: StatutoryOverrideApplyScope;
}): Promise<PropagateStickyPayeResult> {
  const applyScope = input.applyScope ?? "THROUGH_YEAR_END";

  if (applyScope === "THIS_PERIOD") {
    return {
      appliedPeriodEnds: [],
      skippedPostedPeriodEnds: [],
      skippedMidMonthPeriodEnds: [],
      employmentEndDate: null,
      continuous: false,
      applyScope,
    };
  }

  const payeDecimal = toDecimal(input.payeAmount);
  const nisDecimal = toDecimal(input.nisEmployeeAmount);
  const healthDecimal = toDecimal(input.healthSurchargeAmount);

  if (payeDecimal == null && nisDecimal == null && healthDecimal == null) {
    return {
      appliedPeriodEnds: [],
      skippedPostedPeriodEnds: [],
      skippedMidMonthPeriodEnds: [],
      employmentEndDate: null,
      continuous: false,
      applyScope,
    };
  }

  const context = await loadEmploymentContext(input.employeeId);
  const fromPeriodEnd = new Date(
    Date.UTC(
      input.fromPeriodEnd.getUTCFullYear(),
      input.fromPeriodEnd.getUTCMonth(),
      input.fromPeriodEnd.getUTCDate(),
    ),
  );
  const taxYear = taxYearFromAsOfKey(toStatutoryAsOfKey(fromPeriodEnd));

  const continuous = resolveContinuousEmploymentEnd({
    contracts: context.contracts,
    employeeTerminationDate: context.terminationDate,
    asOf: fromPeriodEnd,
  });

  if (applyScope === "THROUGH_CONTRACT_END" && !continuous.endDate) {
    throw new Error(
      "Contract / employment end date is required for “through contract end”.",
    );
  }

  const projectionEndDate = resolveProjectionEnd({
    applyScope,
    taxYear,
    continuousEnd: continuous.endDate,
  });

  const asOfDate = input.excludeFromPeriod
    ? fromPeriodEnd
    : dayBefore(fromPeriodEnd);

  const periodEnds = listRemainingMonthlyPeriodEnds({
    taxYear,
    asOfDate,
    projectionEndDate,
    employmentStartDate: context.hireDate,
  });

  const posted = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      payrollPeriod: { periodEnd: { in: periodEnds } },
    },
    select: { payrollPeriod: { select: { periodEnd: true } } },
  });
  const postedKeys = new Set(
    posted.map((slip) => isoDate(slip.payrollPeriod.periodEnd)),
  );
  const { open, skippedPosted } = filterOpenPeriodEnds(periodEnds, postedKeys);

  const skippedMidMonth: Date[] = [];
  const toApply: Date[] = [];
  for (const periodEnd of open) {
    if (
      payeDecimal != null &&
      shouldSkipPayeAutoApplyForPeriod({
        periodEnd,
        employmentEndDate: continuous.endDate,
      })
    ) {
      skippedMidMonth.push(periodEnd);
      continue;
    }
    toApply.push(periodEnd);
  }

  const scopeLabel =
    applyScope === "THROUGH_CONTRACT_END"
      ? "Through contract end"
      : "Through year end";
  const stickyReason = input.reason.startsWith("Sticky")
    ? input.reason
    : `Sticky · ${scopeLabel} · ${input.reason}`;

  const emptyAudit: AuditRequestMetadata = {
    ipAddress: null,
    userAgent: null,
    clientHostName: null,
  };
  const metadata = input.metadata ?? emptyAudit;

  await prisma.$transaction(async (transaction) => {
    for (const periodEnd of toApply) {
      await transaction.employeePayrollStatutoryOverride.upsert({
        where: {
          employeeId_periodEnd: {
            employeeId: input.employeeId,
            periodEnd,
          },
        },
        create: {
          organizationId: context.organizationId,
          employeeId: input.employeeId,
          taxYear,
          periodEnd,
          payeAmount: payeDecimal,
          nisEmployeeAmount: nisDecimal,
          healthSurchargeAmount: healthDecimal,
          reason: stickyReason,
          applyScope,
          status: "APPROVED",
          requestedByUserId: input.actorUserId,
          approvedByUserId: input.actorUserId,
          approvedAt: new Date(),
        },
        update: {
          ...(payeDecimal != null ? { payeAmount: payeDecimal } : {}),
          ...(nisDecimal != null ? { nisEmployeeAmount: nisDecimal } : {}),
          ...(healthDecimal != null
            ? { healthSurchargeAmount: healthDecimal }
            : {}),
          reason: stickyReason,
          applyScope,
          status: "APPROVED",
          requestedByUserId: input.actorUserId,
          approvedByUserId: input.actorUserId,
          approvedAt: new Date(),
          rejectedReason: null,
        },
      });
    }

    await recordAuditEvent(transaction, {
      userId: input.actorUserId,
      organizationId: context.organizationId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeePayrollStatutoryOverride",
      entityId: input.employeeId,
      description: `Statutory override forward-fill (${applyScope}) applied to ${toApply.length} open period(s) for ${context.firstName} ${context.lastName}.`,
      newValues: {
        applyScope,
        payeAmount: payeDecimal != null ? Number(payeDecimal.toString()) : null,
        nisEmployeeAmount:
          nisDecimal != null ? Number(nisDecimal.toString()) : null,
        healthSurchargeAmount:
          healthDecimal != null ? Number(healthDecimal.toString()) : null,
        appliedPeriodEnds: toApply.map(isoDate),
        skippedPostedPeriodEnds: skippedPosted.map(isoDate),
        skippedMidMonthPeriodEnds: skippedMidMonth.map(isoDate),
        employmentEndDate: continuous.endDate
          ? isoDate(continuous.endDate)
          : null,
        continuous: continuous.continuous,
      },
      ...metadata,
    });
  });

  return {
    appliedPeriodEnds: toApply.map(isoDate),
    skippedPostedPeriodEnds: skippedPosted.map(isoDate),
    skippedMidMonthPeriodEnds: skippedMidMonth.map(isoDate),
    employmentEndDate: continuous.endDate ? isoDate(continuous.endDate) : null,
    continuous: continuous.continuous,
    applyScope,
  };
}
