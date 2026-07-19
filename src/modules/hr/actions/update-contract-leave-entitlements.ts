"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { createContractLeaveBalances } from "@/src/modules/hr/services/create-contract-leave-balances";

export type ContractLeaveEntitlementFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseNonNegativeDays(
  raw: string,
  field: string,
  label: string,
  fieldErrors: Record<string, string>,
): number | null {
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    fieldErrors[field] = `Enter a valid non-negative number of ${label} days.`;
    return null;
  }

  return parsed;
}

export async function updateCurrentContractLeaveEntitlements(
  _previousState: ContractLeaveEntitlementFormState,
  formData: FormData,
): Promise<ContractLeaveEntitlementFormState> {
  const actor = await requireActor(
    "leave.manage",
    "people.manage",
    "contracts.manage",
  );

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const contractId = textValue(formData, "contractId");
  const vacationEnabled = formData.get("vacationLeaveEnabled") === "on";
  const sickEnabled = formData.get("sickLeaveEnabled") === "on";
  const vacationLeaveDaysRaw = textValue(formData, "vacationLeaveDays");
  const sickLeaveDaysRaw = textValue(formData, "sickLeaveDays");
  const fieldErrors: Record<string, string> = {};

  if (!employeeId || !contractId) {
    return {
      status: "error",
      message: "Employee or contract details are missing.",
    };
  }

  const vacationLeaveDays = vacationEnabled
    ? parseNonNegativeDays(
        vacationLeaveDaysRaw,
        "vacationLeaveDays",
        "vacation leave",
        fieldErrors,
      )
    : 0;

  if (vacationEnabled && vacationLeaveDays == null && !fieldErrors.vacationLeaveDays) {
    fieldErrors.vacationLeaveDays =
      "Enter vacation leave days, or uncheck Include vacation leave.";
  }

  const sickLeaveDays = sickEnabled
    ? parseNonNegativeDays(
        sickLeaveDaysRaw,
        "sickLeaveDays",
        "sick leave",
        fieldErrors,
      )
    : 0;

  if (sickEnabled && sickLeaveDays == null && !fieldErrors.sickLeaveDays) {
    fieldErrors.sickLeaveDays =
      "Enter sick leave days, or uncheck Include sick leave.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the leave entitlement fields.",
      fieldErrors,
    };
  }

  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
      isCurrent: true,
    },
    select: {
      id: true,
      status: true,
      endDate: true,
      vacationLeaveDaysOverride: true,
      sickLeaveDaysOverride: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!contract) {
    return {
      status: "error",
      message: "No current employment contract was found for this employee.",
    };
  }

  if (contract.status !== "ACTIVE") {
    return {
      status: "error",
      message:
        "Leave entitlements can only be adjusted on the current active contract.",
    };
  }

  if (!contract.endDate) {
    return {
      status: "error",
      message: "The contract needs an end date before leave balances can update.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const vacationOverride = vacationEnabled
    ? new Prisma.Decimal(vacationLeaveDays as number)
    : new Prisma.Decimal(0);
  const sickOverride = sickEnabled
    ? new Prisma.Decimal(sickLeaveDays as number)
    : new Prisma.Decimal(0);

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employmentContract.update({
        where: { id: contract.id },
        data: {
          vacationLeaveDaysOverride: vacationOverride,
          sickLeaveDaysOverride: sickOverride,
        },
      });

      await createContractLeaveBalances(
        contract.id,
        actor.actor.userId,
        undefined,
        transaction,
      );

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmploymentContract",
          entityId: contract.id,
          description: `Updated leave entitlements for ${contract.employee.employeeNumber} — ${contract.employee.firstName} ${contract.employee.lastName}.`,
          oldValues: {
            vacationLeaveDaysOverride:
              contract.vacationLeaveDaysOverride?.toString() ?? null,
            sickLeaveDaysOverride:
              contract.sickLeaveDaysOverride?.toString() ?? null,
          },
          newValues: {
            vacationLeaveDaysOverride: vacationOverride?.toString() ?? null,
            sickLeaveDaysOverride: sickOverride?.toString() ?? null,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidatePath("/people/leave/balances");
    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath(`/people/employees/${employeeId}/contracts`);
    revalidatePath(`/people/employees/${employeeId}/contracts/${contractId}`);
    revalidatePath("/people/leave");

    return {
      status: "success",
      message: "Leave entitlements updated for the current contract.",
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to update leave entitlements.",
    };
  }
}
