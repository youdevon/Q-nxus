"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import {
  LeaveBalanceTransactionType,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { computeLeaveAvailable } from "@/src/modules/hr/lib/leave-balance-math";

export type LeaveOpeningBalanceFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateLeaveOpeningBalance(
  _previousState: LeaveOpeningBalanceFormState,
  formData: FormData,
): Promise<LeaveOpeningBalanceFormState> {
  const actor = await requireActor("leave.manage", "people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const leaveBalanceId = textValue(formData, "leaveBalanceId");
  const openingBalanceRaw = textValue(formData, "openingBalance");
  const fieldErrors: Record<string, string> = {};

  if (!employeeId || !leaveBalanceId) {
    return {
      status: "error",
      message: "Employee or leave balance details are missing.",
    };
  }

  const openingBalanceNumber = Number(openingBalanceRaw);

  if (!openingBalanceRaw || !Number.isFinite(openingBalanceNumber)) {
    fieldErrors.openingBalance = "Enter a valid opening balance in days.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the opening balance field.",
      fieldErrors,
    };
  }

  const balance = await prisma.employeeLeaveBalance.findFirst({
    where: {
      id: leaveBalanceId,
      employeeId,
      contract: {
        isCurrent: true,
      },
    },
    select: {
      id: true,
      contractId: true,
      leaveTypeId: true,
      openingBalance: true,
      entitlement: true,
      accrued: true,
      carriedForward: true,
      adjustments: true,
      reserved: true,
      taken: true,
      availableBalance: true,
      leaveType: {
        select: {
          code: true,
          name: true,
        },
      },
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!balance) {
    return {
      status: "error",
      message: "No current-contract leave balance was found for this employee.",
    };
  }

  const openingBalance = new Prisma.Decimal(openingBalanceNumber);
  const nextAvailable = computeLeaveAvailable({
    openingBalance: openingBalance.toString(),
    entitlement: balance.entitlement.toString(),
    accrued: balance.accrued.toString(),
    carriedForward: balance.carriedForward.toString(),
    adjustments: balance.adjustments.toString(),
    reserved: balance.reserved.toString(),
    taken: balance.taken.toString(),
  });
  const delta = openingBalance.minus(balance.openingBalance);
  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.employeeLeaveBalance.updateMany({
        where: {
          id: balance.id,
          openingBalance: balance.openingBalance,
          availableBalance: balance.availableBalance,
        },
        data: {
          openingBalance,
          availableBalance: new Prisma.Decimal(nextAvailable),
          lastCalculatedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new Error(
          "Leave balance changed concurrently. Refresh and try again.",
        );
      }

      if (!delta.equals(0)) {
        await transaction.leaveBalanceTransaction.create({
          data: {
            employeeId,
            contractId: balance.contractId,
            leaveTypeId: balance.leaveTypeId,
            leaveBalanceId: balance.id,
            transactionType: LeaveBalanceTransactionType.OPENING_BALANCE,
            quantity: delta,
            balanceBefore: balance.availableBalance,
            balanceAfter: new Prisma.Decimal(nextAvailable),
            effectiveDate: new Date(),
            referenceType: "EmployeeLeaveBalance",
            referenceId: balance.id,
            description: `Set ${balance.leaveType.name} opening balance to ${openingBalance.toString()} days.`,
            createdByUserId: actor.actor.userId,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmployeeLeaveBalance",
          entityId: balance.id,
          description: `Updated ${balance.leaveType.code} opening balance for ${balance.employee.employeeNumber} — ${balance.employee.firstName} ${balance.employee.lastName}.`,
          oldValues: {
            openingBalance: balance.openingBalance.toString(),
            availableBalance: balance.availableBalance.toString(),
          },
          newValues: {
            openingBalance: openingBalance.toString(),
            availableBalance: nextAvailable,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidatePath("/people/leave/balances");
    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath("/people/leave");
    revalidatePath("/me/leave");

    return {
      status: "success",
      message: `${balance.leaveType.name} opening balance updated.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to update the opening balance.",
    };
  }
}
