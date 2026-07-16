"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type MarkContractCollectedState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function markEmploymentContractCollected(
  _previousState: MarkContractCollectedState,
  formData: FormData,
): Promise<MarkContractCollectedState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const contractId = textValue(formData, "contractId");

  if (!employeeId || !contractId) {
    return {
      status: "error",
      message: "Contract details are missing.",
    };
  }

  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
    },
    select: {
      id: true,
      collectedAt: true,
      contractNumber: true,
      jobTitle: true,
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
      message: "The employment contract no longer exists.",
    };
  }

  if (contract.collectedAt) {
    return {
      status: "success",
      message: "This contract is already marked as collected.",
    };
  }

  const collectedAt = new Date();
  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employmentContract.update({
        where: {
          id: contract.id,
        },
        data: {
          collectedAt,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmploymentContract",
          entityId: contract.id,
          description: `Marked employment contract as collected for ${contract.employee.employeeNumber} — ${contract.employee.firstName} ${contract.employee.lastName}.`,
          newValues: {
            collectedAt: collectedAt.toISOString(),
            contractNumber: contract.contractNumber,
            jobTitle: contract.jobTitle,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath(`/people/employees/${employeeId}/contracts`);
    revalidatePath(`/people/employees/${employeeId}/contracts/${contractId}`);

    return {
      status: "success",
      message: "Contract marked as collected.",
    };
  } catch (error) {
    console.error("Unable to mark employment contract as collected:", error);

    return {
      status: "error",
      message: "The contract could not be marked as collected.",
    };
  }
}
