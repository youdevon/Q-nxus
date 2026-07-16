"use server";

import { revalidatePath } from "next/cache";

import {
  EmploymentType,
  LeaveAccrualMethod,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { rebuildCurrentContractLeaveBalances } from "@/src/modules/hr/services/rebuild-leave-balances";

export type LeaveEntitlementFormState = {
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

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

const employmentTypes = new Set<string>(Object.values(EmploymentType));
const accrualMethods = new Set<string>(Object.values(LeaveAccrualMethod));

function formatRebuildMessage(
  result: Awaited<ReturnType<typeof rebuildCurrentContractLeaveBalances>>,
): string {
  const base = `Rebuilt balances for ${result.contractsUpdated}/${result.contractsConsidered} current contract(s) (${result.balancesUpdated} updated, ${result.balancesCreated} created).`;

  if (result.errors.length === 0) {
    return base;
  }

  return `${base} ${result.errors.length} contract(s) failed.`;
}

export async function saveLeaveEntitlementRule(
  _previousState: LeaveEntitlementFormState,
  formData: FormData,
): Promise<LeaveEntitlementFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const id = nullableText(formData, "id");
  const leaveTypeId = textValue(formData, "leaveTypeId");
  const name = textValue(formData, "name");
  const employmentTypeRaw = nullableText(formData, "employmentType");
  const annualEntitlementRaw = textValue(formData, "annualEntitlement");
  const accrualMethodRaw =
    textValue(formData, "accrualMethod") || "ANNUAL_GRANT";
  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));
  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;
  const minimumServiceMonths = Number.parseInt(
    textValue(formData, "minimumServiceMonths") || "0",
    10,
  );
  const maximumServiceMonthsRaw = nullableText(
    formData,
    "maximumServiceMonths",
  );
  const maximumServiceMonths = maximumServiceMonthsRaw
    ? Number.parseInt(maximumServiceMonthsRaw, 10)
    : null;
  const priority = Number.parseInt(textValue(formData, "priority") || "0", 10);
  const isActive = formData.get("isActive") === "on";
  const rebuildBalances = formData.get("rebuildBalances") === "on";

  const fieldErrors: Record<string, string> = {};

  if (!leaveTypeId) {
    fieldErrors.leaveTypeId = "Leave type is required.";
  }

  if (name.length < 2) {
    fieldErrors.name = "Name must contain at least two characters.";
  }

  let annualEntitlement: Prisma.Decimal | null = null;

  try {
    annualEntitlement = new Prisma.Decimal(annualEntitlementRaw || "0");
    if (annualEntitlement.isNeg()) {
      fieldErrors.annualEntitlement = "Annual entitlement cannot be negative.";
    }
  } catch {
    fieldErrors.annualEntitlement = "Enter a valid annual entitlement.";
  }

  if (!accrualMethods.has(accrualMethodRaw)) {
    fieldErrors.accrualMethod = "Select a valid accrual method.";
  }

  if (employmentTypeRaw && !employmentTypes.has(employmentTypeRaw)) {
    fieldErrors.employmentType = "Select a valid employment type.";
  }

  if (!effectiveFrom) {
    fieldErrors.effectiveFrom = "Enter a valid effective-from date.";
  }

  if (effectiveToRaw && !effectiveTo) {
    fieldErrors.effectiveTo = "Enter a valid effective-to date.";
  }

  if (!Number.isInteger(minimumServiceMonths) || minimumServiceMonths < 0) {
    fieldErrors.minimumServiceMonths =
      "Minimum service months must be zero or greater.";
  }

  if (
    maximumServiceMonthsRaw &&
    (maximumServiceMonths === null ||
      !Number.isInteger(maximumServiceMonths) ||
      maximumServiceMonths < 0)
  ) {
    fieldErrors.maximumServiceMonths =
      "Maximum service months must be a non-negative integer.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the entitlement rule.",
      fieldErrors,
    };
  }

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { id: true, organizationId: true, code: true },
  });

  if (!leaveType) {
    return {
      status: "error",
      message: "The leave type could not be found.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const data = {
    name,
    employmentType: (employmentTypeRaw as EmploymentType | null) ?? null,
    minimumServiceMonths,
    maximumServiceMonths,
    annualEntitlement: annualEntitlement!,
    accrualMethod: accrualMethodRaw as LeaveAccrualMethod,
    effectiveFrom: effectiveFrom!,
    effectiveTo,
    priority: Number.isInteger(priority) ? priority : 0,
    isActive,
  };

  try {
    const saved = id
      ? await prisma.leaveEntitlementRule.update({
          where: { id },
          data,
        })
      : await prisma.leaveEntitlementRule.create({
          data: {
            organizationId: leaveType.organizationId,
            leaveTypeId: leaveType.id,
            ...data,
          },
        });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: id ? "UPDATE" : "CREATE",
        entityType: "LeaveEntitlementRule",
        entityId: saved.id,
        description: `${id ? "Updated" : "Created"} entitlement rule for leave type ${leaveType.code}.`,
        newValues: data,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    let message = id
      ? "Entitlement rule updated."
      : "Entitlement rule created.";

    if (rebuildBalances) {
      try {
        const rebuild = await rebuildCurrentContractLeaveBalances({
          organizationId: leaveType.organizationId,
          createdByUserId: actor.actor.userId,
        });

        await prisma.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "hr",
            action: "REBUILD",
            entityType: "EmployeeLeaveBalance",
            entityId: leaveType.id,
            description: `Rebuilt leave balances after entitlement rule change for ${leaveType.code}.`,
            newValues: {
              contractsConsidered: rebuild.contractsConsidered,
              contractsUpdated: rebuild.contractsUpdated,
              balancesCreated: rebuild.balancesCreated,
              balancesUpdated: rebuild.balancesUpdated,
              errorCount: rebuild.errors.length,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        message = `${message} ${formatRebuildMessage(rebuild)}`;
      } catch (rebuildError) {
        console.error(
          "Entitlement rule saved but balance rebuild failed:",
          rebuildError,
        );
        message = `${message} Balance rebuild failed — use Rebuild balances on this page.`;
      }
    }

    revalidatePath(`/people/leave/types/${leaveTypeId}`);
    revalidatePath("/people/leave/types");
    revalidatePath("/people/leave/balances");

    return {
      status: "success",
      message,
    };
  } catch (error) {
    console.error("Unable to save entitlement rule:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The entitlement rule could not be saved.",
    };
  }
}

export async function rebuildLeaveBalancesForLeaveType(
  _previousState: LeaveEntitlementFormState,
  formData: FormData,
): Promise<LeaveEntitlementFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const leaveTypeId = textValue(formData, "leaveTypeId");

  if (!leaveTypeId) {
    return {
      status: "error",
      message: "The leave type could not be found.",
    };
  }

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { id: true, organizationId: true, code: true },
  });

  if (!leaveType) {
    return {
      status: "error",
      message: "The leave type could not be found.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const rebuild = await rebuildCurrentContractLeaveBalances({
      organizationId: leaveType.organizationId,
      createdByUserId: actor.actor.userId,
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "REBUILD",
        entityType: "EmployeeLeaveBalance",
        entityId: leaveType.id,
        description: `Rebuilt leave balances for leave type ${leaveType.code}.`,
        newValues: {
          contractsConsidered: rebuild.contractsConsidered,
          contractsUpdated: rebuild.contractsUpdated,
          balancesCreated: rebuild.balancesCreated,
          balancesUpdated: rebuild.balancesUpdated,
          errorCount: rebuild.errors.length,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath(`/people/leave/types/${leaveTypeId}`);
    revalidatePath("/people/leave/types");
    revalidatePath("/people/leave/balances");

    return {
      status: rebuild.errors.length > 0 ? "error" : "success",
      message: formatRebuildMessage(rebuild),
    };
  } catch (error) {
    console.error("Unable to rebuild leave balances:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Leave balances could not be rebuilt.",
    };
  }
}
