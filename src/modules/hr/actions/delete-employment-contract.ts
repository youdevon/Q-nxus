"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EmploymentContractStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { canDeleteEmploymentContract } from "@/src/modules/hr/lib/can-delete-employment-contract";
import { disposeContractStoredDocument } from "@/src/modules/hr/lib/dispose-contract-stored-document";

export type DeleteEmploymentContractState = {
  status: "idle" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hasPositiveDecimal(value: { toString(): string } | number): boolean {
  return Number(value) > 0;
}

export async function deleteEmploymentContract(
  _previousState: DeleteEmploymentContractState,
  formData: FormData,
): Promise<DeleteEmploymentContractState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const contractId = textValue(formData, "contractId");
  const confirmed = formData.get("confirmed") === "on";

  if (!employeeId || !contractId) {
    return {
      status: "error",
      message: "Contract details are missing.",
    };
  }

  if (!confirmed) {
    return {
      status: "error",
      message: "Confirm that this contract should be permanently deleted.",
    };
  }

  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
    },
    include: {
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      leaveBalances: {
        select: {
          taken: true,
          reserved: true,
        },
      },
      _count: {
        select: {
          amendments: true,
          leaveRequests: true,
        },
      },
    },
  });

  if (!contract) {
    return {
      status: "error",
      message: "The employment contract no longer exists.",
    };
  }

  const previousStoredFileId = contract.storedFileId;
  const previousStorageKey = contract.documentStorageKey;

  const contractEffectiveEnd =
    contract.terminationDate ?? contract.endDate ?? null;

  const postedOverlap = await prisma.payslip.findFirst({
    where: {
      employeeId,
      status: "POSTED",
      payrollPeriod: {
        periodStart: {
          lte: contractEffectiveEnd ?? new Date("9999-12-31T00:00:00.000Z"),
        },
        periodEnd: {
          gte: contract.startDate,
        },
      },
    },
    select: {
      id: true,
    },
  });

  const deletionCheck = canDeleteEmploymentContract({
    hasChildAmendments: contract._count.amendments > 0,
    leaveRequestCount: contract._count.leaveRequests,
    hasLeaveUsage: contract.leaveBalances.some(
      (balance) =>
        hasPositiveDecimal(balance.taken) ||
        hasPositiveDecimal(balance.reserved),
    ),
    hasPostedPayrollOverlap: Boolean(postedOverlap),
  });

  if (!deletionCheck.allowed) {
    return {
      status: "error",
      message: deletionCheck.reason,
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      if (contract.isCurrent && contract.sourceContractId) {
        await transaction.employmentContract.updateMany({
          where: {
            id: contract.sourceContractId,
            employeeId,
            status: EmploymentContractStatus.SUPERSEDED,
          },
          data: {
            isCurrent: true,
            status: EmploymentContractStatus.ACTIVE,
          },
        });
      }

      await transaction.employmentContract.delete({
        where: {
          id: contract.id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "DELETE",
          entityType: "EmploymentContract",
          entityId: contract.id,
          description: `Deleted employment contract for ${contract.employee.employeeNumber} — ${contract.employee.firstName} ${contract.employee.lastName}.`,
          oldValues: {
            contractNumber: contract.contractNumber,
            changeType: contract.changeType,
            status: contract.status,
            isCurrent: contract.isCurrent,
            startDate: contract.startDate,
            endDate: contract.endDate,
            jobTitle: contract.jobTitle,
            baseSalary: contract.baseSalary.toString(),
            sourceContractId: contract.sourceContractId,
            restoredSourceContractId:
              contract.isCurrent && contract.sourceContractId
                ? contract.sourceContractId
                : null,
            documentStorageKey: previousStorageKey,
            storedFileId: previousStoredFileId,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    try {
      await disposeContractStoredDocument({
        storedFileId: previousStoredFileId,
        storageKey: previousStorageKey,
      });
    } catch (cleanupError) {
      console.error(
        "Failed to clean up deleted contract document:",
        cleanupError,
      );
    }

    revalidatePath("/contracts");
    revalidatePath("/people");
    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath(`/people/employees/${employeeId}/contracts`);
    revalidatePath("/people/leave/balances");
    revalidatePath("/people/leave");

    redirect(`/people/employees/${employeeId}/contracts`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to delete employment contract:", error);

    return {
      status: "error",
      message: "The employment contract could not be deleted.",
    };
  }
}
