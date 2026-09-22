"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EmploymentContractStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { canDeleteEmploymentContract } from "@/src/modules/hr/lib/can-delete-employment-contract";
import {
  detachEmploymentContractRestrictDependents,
  disposeLeaveAttachmentFiles,
} from "@/src/modules/hr/lib/detach-employment-contract-dependents";
import { disposeContractStoredDocument } from "@/src/modules/hr/lib/dispose-contract-stored-document";
import {
  isEmploymentContractCleanupEligible,
  planBulkExpiredContractCleanup,
  planExpiredContractCleanupCascade,
  type CleanupCascadeContract,
} from "@/src/modules/hr/lib/expired-contract-cleanup";

export type DeleteEmploymentContractState = {
  status: "idle" | "error" | "success";
  message: string;
  deletedCount?: number;
};

type AuditMetadata = Awaited<ReturnType<typeof getAuditRequestMetadata>>;

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hasPositiveDecimal(value: { toString(): string } | number): boolean {
  return Number(value) > 0;
}

function revalidateAfterContractDelete(
  employeeId: string,
  contractIds: readonly string[],
) {
  const paths = new Set([
    "/contracts",
    "/people",
    `/people/employees/${employeeId}`,
    `/people/employees/${employeeId}/contracts`,
    `/people/employees/${employeeId}/assignments`,
    `/people/employees/${employeeId}/documents`,
    "/people/leave/balances",
    "/people/leave",
    "/me",
    "/me/contracts",
    "/me/gratuity",
    "/payroll",
    "/payroll/salaries",
    "/payroll/runs",
    "/payroll/gratuity",
    `/payroll/employees/${employeeId}`,
    `/payroll/employees/${employeeId}/payslip`,
  ]);

  for (const contractId of contractIds) {
    paths.add(`/people/employees/${employeeId}/contracts/${contractId}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }
}

async function loadEmployeeCleanupContracts(
  employeeId: string,
): Promise<CleanupCascadeContract[]> {
  const rows = await prisma.employmentContract.findMany({
    where: { employeeId },
    select: {
      id: true,
      sourceContractId: true,
      status: true,
      endDate: true,
      isCurrent: true,
      contractNumber: true,
      jobTitle: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sourceContractId: row.sourceContractId,
    status: row.status,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    contractNumber: row.contractNumber,
    jobTitle: row.jobTitle,
  }));
}

async function deleteContractRowsTipFirst(input: {
  transaction: Prisma.TransactionClient;
  employeeId: string;
  actorUserId: string;
  metadata: AuditMetadata;
  employeeLabel: string;
  contracts: CleanupCascadeContract[];
  cleanupMode: boolean;
  bulkCleanup?: boolean;
}): Promise<{
  documents: Array<{
    storedFileId: string | null;
    storageKey: string | null;
  }>;
  leaveAttachmentStorageKeys: string[];
}> {
  const deleteIds = new Set(input.contracts.map((row) => row.id));

  const { leaveAttachmentStorageKeys } =
    await detachEmploymentContractRestrictDependents(input.transaction, [
      ...deleteIds,
    ]);

  const documents: Array<{
    storedFileId: string | null;
    storageKey: string | null;
  }> = [];

  for (const row of input.contracts) {
    const contract = await input.transaction.employmentContract.findFirst({
      where: {
        id: row.id,
        employeeId: input.employeeId,
      },
      select: {
        id: true,
        contractNumber: true,
        changeType: true,
        status: true,
        isCurrent: true,
        startDate: true,
        endDate: true,
        jobTitle: true,
        baseSalary: true,
        sourceContractId: true,
        storedFileId: true,
        documentStorageKey: true,
      },
    });

    if (!contract) {
      continue;
    }

    const shouldRestoreSource =
      contract.isCurrent &&
      contract.sourceContractId &&
      !deleteIds.has(contract.sourceContractId);

    if (shouldRestoreSource && contract.sourceContractId) {
      await input.transaction.employmentContract.updateMany({
        where: {
          id: contract.sourceContractId,
          employeeId: input.employeeId,
          status: EmploymentContractStatus.SUPERSEDED,
        },
        data: {
          isCurrent: true,
          status: EmploymentContractStatus.ACTIVE,
        },
      });
    }

    // Prisma Cascade removes: allowances, approval steps, leave balances,
    // leave transactions, gratuity settlements, gratuity accrual entries.
    // Live successors keep their rows; sourceContractId is SetNull.
    await input.transaction.employmentContract.delete({
      where: {
        id: contract.id,
      },
    });

    await input.transaction.auditEvent.create({
      data: {
        userId: input.actorUserId,
        moduleKey: "hr",
        action: "DELETE",
        entityType: "EmploymentContract",
        entityId: contract.id,
        description: `Deleted employment contract for ${input.employeeLabel}.`,
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
          restoredSourceContractId: shouldRestoreSource
            ? contract.sourceContractId
            : null,
          documentStorageKey: contract.documentStorageKey,
          storedFileId: contract.storedFileId,
          cleanupMode: input.cleanupMode,
          bulkCleanup: input.bulkCleanup ?? false,
          cascadedCleanup: deleteIds.size > 1,
        },
        ipAddress: input.metadata.ipAddress,
        userAgent: input.metadata.userAgent,
        clientHostName: input.metadata.clientHostName,
      },
    });

    documents.push({
      storedFileId: contract.storedFileId,
      storageKey: contract.documentStorageKey,
    });
  }

  return { documents, leaveAttachmentStorageKeys };
}

async function disposeDeletedArtifacts(input: {
  documents: Array<{
    storedFileId: string | null;
    storageKey: string | null;
  }>;
  leaveAttachmentStorageKeys: string[];
}) {
  await disposeLeaveAttachmentFiles(input.leaveAttachmentStorageKeys);

  for (const document of input.documents) {
    try {
      await disposeContractStoredDocument({
        storedFileId: document.storedFileId,
        storageKey: document.storageKey,
      });
    } catch (cleanupError) {
      console.error(
        "Failed to clean up deleted contract document:",
        cleanupError,
      );
    }
  }
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
  const redirectTo = textValue(formData, "redirectTo");

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

  const cleanupEligible = isEmploymentContractCleanupEligible({
    status: contract.status,
    endDate: contract.endDate,
  });

  const contractEffectiveEnd =
    contract.terminationDate ?? contract.endDate ?? null;

  const postedOverlap = cleanupEligible
    ? null
    : await prisma.payslip.findFirst({
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
    cleanupEligible,
  });

  if (!deletionCheck.allowed) {
    return {
      status: "error",
      message: deletionCheck.reason,
    };
  }

  const employeeLabel = `${contract.employee.employeeNumber} — ${contract.employee.firstName} ${contract.employee.lastName}`;
  const metadata = await getAuditRequestMetadata(formData);

  try {
    let deletedContractIds: string[] = [contractId];
    let artifacts: {
      documents: Array<{
        storedFileId: string | null;
        storageKey: string | null;
      }>;
      leaveAttachmentStorageKeys: string[];
    };

    if (deletionCheck.mode === "cleanup") {
      const employeeContracts = await loadEmployeeCleanupContracts(employeeId);
      const cascade = planExpiredContractCleanupCascade(
        contractId,
        employeeContracts,
      );

      if (!cascade.ok) {
        return {
          status: "error",
          message: cascade.reason,
        };
      }

      deletedContractIds = cascade.contracts.map((row) => row.id);

      artifacts = await prisma.$transaction(async (transaction) =>
        deleteContractRowsTipFirst({
          transaction,
          employeeId,
          actorUserId: actor.actor.userId,
          metadata,
          employeeLabel,
          contracts: cascade.contracts,
          cleanupMode: true,
        }),
      );
    } else {
      artifacts = await prisma.$transaction(async (transaction) =>
        deleteContractRowsTipFirst({
          transaction,
          employeeId,
          actorUserId: actor.actor.userId,
          metadata,
          employeeLabel,
          contracts: [
            {
              id: contract.id,
              sourceContractId: contract.sourceContractId,
              status: contract.status,
              endDate: contract.endDate,
              isCurrent: contract.isCurrent,
              contractNumber: contract.contractNumber,
              jobTitle: contract.jobTitle,
            },
          ],
          cleanupMode: false,
        }),
      );
    }

    await disposeDeletedArtifacts(artifacts);
    revalidateAfterContractDelete(employeeId, deletedContractIds);

    if (redirectTo === "/contracts" || redirectTo.startsWith("/contracts?")) {
      redirect(redirectTo);
    }

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

/**
 * Bulk-delete cleanup-eligible expired contracts, cascading later expired
 * versions tip-first. Used from Contract Monitoring when filtered to Expired.
 */
export async function deleteExpiredEmploymentContracts(
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

  const confirmed = formData.get("confirmed") === "on";
  if (!confirmed) {
    return {
      status: "error",
      message: "Confirm that expired contracts should be permanently deleted.",
    };
  }

  const selectedIds = formData
    .getAll("contractId")
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

  if (selectedIds.length === 0) {
    return {
      status: "error",
      message: "Select at least one expired contract to delete.",
    };
  }

  const selectedContracts = await prisma.employmentContract.findMany({
    where: {
      id: { in: selectedIds },
    },
    select: {
      id: true,
      employeeId: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (selectedContracts.length === 0) {
    return {
      status: "error",
      message: "No matching expired contracts were found.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const employeeIds = new Set<string>();
  let deletedCount = 0;
  const blocked: string[] = [];
  const allDocuments: Array<{
    storedFileId: string | null;
    storageKey: string | null;
  }> = [];
  const allLeaveAttachmentKeys: string[] = [];

  const byEmployee = new Map<string, typeof selectedContracts>();
  for (const row of selectedContracts) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  for (const [employeeId, rows] of byEmployee) {
    const employeeLabel = `${rows[0]!.employee.employeeNumber} — ${rows[0]!.employee.firstName} ${rows[0]!.employee.lastName}`;
    const employeeContracts = await loadEmployeeCleanupContracts(employeeId);
    const plan = planBulkExpiredContractCleanup(
      rows.map((row) => row.id),
      employeeContracts,
    );

    if (!plan.ok) {
      blocked.push(`${rows[0]!.employee.employeeNumber}: ${plan.reason}`);
      continue;
    }

    try {
      const artifacts = await prisma.$transaction(async (transaction) =>
        deleteContractRowsTipFirst({
          transaction,
          employeeId,
          actorUserId: actor.actor.userId,
          metadata,
          employeeLabel,
          contracts: plan.contracts,
          cleanupMode: true,
          bulkCleanup: true,
        }),
      );

      allDocuments.push(...artifacts.documents);
      allLeaveAttachmentKeys.push(...artifacts.leaveAttachmentStorageKeys);
      employeeIds.add(employeeId);
      deletedCount += plan.contracts.length;
      revalidateAfterContractDelete(
        employeeId,
        plan.contracts.map((row) => row.id),
      );
    } catch (error) {
      console.error("Unable to delete expired employment contracts:", error);
      blocked.push(rows[0]!.employee.employeeNumber);
    }
  }

  await disposeDeletedArtifacts({
    documents: allDocuments,
    leaveAttachmentStorageKeys: allLeaveAttachmentKeys,
  });

  revalidatePath("/contracts");
  revalidatePath("/people");
  revalidatePath("/payroll/gratuity");

  if (deletedCount === 0) {
    return {
      status: "error",
      message:
        blocked.length > 0
          ? `No contracts were deleted. ${blocked.slice(0, 2).join(" ")}`
          : "No contracts were deleted.",
    };
  }

  const blockedNote =
    blocked.length > 0
      ? ` ${blocked.length} employee group(s) skipped.`
      : "";

  return {
    status: "success",
    message: `Deleted ${deletedCount} expired contract${deletedCount === 1 ? "" : "s"}.${blockedNote}`,
    deletedCount,
  };
}
