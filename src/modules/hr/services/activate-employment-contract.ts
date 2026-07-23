import {
  EmployeeAssignmentType,
  type Prisma,
} from "@/generated/prisma/client";
import {
  createContractLeaveBalances,
  type LeaveEntitlementOverride,
} from "@/src/modules/hr/services/create-contract-leave-balances";
import { entitlementOverridesFromContractFields } from "@/src/modules/hr/lib/contract-leave-overrides";
import { isHistoricalEndedContract } from "@/src/modules/hr/lib/historical-contract";
import {
  assignEmployeeToPosition,
} from "@/src/modules/hr/services/assign-employee-to-position";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export { isHistoricalEndedContract } from "@/src/modules/hr/lib/historical-contract";

type Tx = Prisma.TransactionClient;

/**
 * Make a draft/approved/signed contract the current ACTIVE contract,
 * or record a past-ended term as EXPIRED history for cutover (no leave
 * balances, no assignment, does not displace the current contract).
 */
export async function activateEmploymentContractInTransaction(
  input: {
    contractId: string;
    employeeId: string;
    organizationId: string;
    actorUserId: string;
    audit: AuditRequestMetadata;
    employeeUpdatedAt?: string | null;
    /** When true, assign position from contract.positionId if set and different. */
    applyAssignment?: boolean;
  },
  transaction: Tx,
): Promise<{ needsAccessRoleSync: boolean; historical: boolean }> {
  const contract = await transaction.employmentContract.findFirst({
    where: {
      id: input.contractId,
      employeeId: input.employeeId,
    },
    select: {
      id: true,
      status: true,
      isCurrent: true,
      startDate: true,
      endDate: true,
      positionId: true,
      departmentId: true,
      changeType: true,
      vacationLeaveDaysOverride: true,
      sickLeaveDaysOverride: true,
      jobTitle: true,
      contractNumber: true,
      contractType: true,
    },
  });

  if (!contract) {
    throw new Error("CONTRACT_NOT_FOUND");
  }

  if (contract.status === "ACTIVE" && contract.isCurrent) {
    return { needsAccessRoleSync: false, historical: false };
  }

  if (
    contract.status !== "DRAFT" &&
    contract.status !== "APPROVED" &&
    contract.status !== "AWAITING_SIGNATURE"
  ) {
    throw new Error("CONTRACT_NOT_ACTIVATABLE");
  }

  const employee = await transaction.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      positionId: true,
      departmentId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      assignments: {
        where: { isCurrent: true },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  const historical = isHistoricalEndedContract(contract.endDate);

  // Past-ended paper terms: store as EXPIRED history without becoming current.
  if (historical) {
    await transaction.employmentContract.update({
      where: { id: contract.id },
      data: {
        status: "EXPIRED",
        isCurrent: false,
        activatedAt: new Date(),
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: input.actorUserId,
        moduleKey: "hr",
        action: "ACTIVATE",
        entityType: "EmploymentContract",
        entityId: contract.id,
        description: `Recorded historical employment contract for ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName} (ended ${contract.endDate!.toISOString().slice(0, 10)}).`,
        newValues: {
          status: "EXPIRED",
          isCurrent: false,
          historical: true,
          contractNumber: contract.contractNumber,
          contractType: contract.contractType,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate!.toISOString().slice(0, 10),
        },
        ipAddress: input.audit.ipAddress,
        userAgent: input.audit.userAgent,
        clientHostName: input.audit.clientHostName,
      },
    });

    return { needsAccessRoleSync: false, historical: true };
  }

  let needsAccessRoleSync = false;

  if (input.applyAssignment !== false && contract.positionId) {
    const selectedPosition = await transaction.position.findFirst({
      where: {
        id: contract.positionId,
        isActive: true,
        department: {
          organizationId: input.organizationId,
          isActive: true,
        },
      },
      select: {
        id: true,
        departmentId: true,
      },
    });

    if (selectedPosition && employee.positionId !== selectedPosition.id) {
      const hasCurrentAssignment = Boolean(employee.assignments[0]);
      const assignmentType =
        contract.changeType === "POSITION_CHANGE"
          ? EmployeeAssignmentType.REASSIGNMENT
          : hasCurrentAssignment
            ? EmployeeAssignmentType.TRANSFER
            : EmployeeAssignmentType.INITIAL_APPOINTMENT;

      await assignEmployeeToPosition(
        {
          employeeId: input.employeeId,
          departmentId: selectedPosition.departmentId,
          positionId: selectedPosition.id,
          assignmentType,
          startDate: contract.startDate,
          reason: "Assigned as part of employment contract activation.",
          expectedEmployeeUpdatedAt: input.employeeUpdatedAt ?? null,
          actorUserId: input.actorUserId,
          audit: input.audit,
        },
        transaction,
      );
      needsAccessRoleSync = true;
    }
  }

  const currentContracts = await transaction.employmentContract.findMany({
    where: {
      employeeId: input.employeeId,
      isCurrent: true,
      id: { not: contract.id },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
  });

  for (const current of currentContracts) {
    const priorEnd =
      contract.startDate.getTime() > current.startDate.getTime()
        ? new Date(
            Date.UTC(
              contract.startDate.getUTCFullYear(),
              contract.startDate.getUTCMonth(),
              contract.startDate.getUTCDate() - 1,
              12,
            ),
          )
        : null;

    await transaction.employmentContract.update({
      where: { id: current.id },
      data: {
        isCurrent: false,
        status: "SUPERSEDED",
        ...(priorEnd &&
        (!current.endDate || current.endDate.getTime() > priorEnd.getTime())
          ? { endDate: priorEnd }
          : {}),
      },
    });
  }

  await transaction.employmentContract.update({
    where: { id: contract.id },
    data: {
      status: "ACTIVE",
      isCurrent: true,
      activatedAt: new Date(),
    },
  });

  const entitlementOverrides: LeaveEntitlementOverride[] =
    entitlementOverridesFromContractFields(contract);

  const existingBalances = await transaction.employeeLeaveBalance.count({
    where: { contractId: contract.id },
  });

  if (existingBalances === 0) {
    await createContractLeaveBalances(
      contract.id,
      input.actorUserId,
      entitlementOverrides.length > 0 ? { entitlementOverrides } : undefined,
      transaction,
    );
  }

  await transaction.auditEvent.create({
    data: {
      userId: input.actorUserId,
      moduleKey: "hr",
      action: "ACTIVATE",
      entityType: "EmploymentContract",
      entityId: contract.id,
      description: `Activated employment contract for ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}.`,
      newValues: {
        status: "ACTIVE",
        isCurrent: true,
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
      },
      ipAddress: input.audit.ipAddress,
      userAgent: input.audit.userAgent,
      clientHostName: input.audit.clientHostName,
    },
  });

  return { needsAccessRoleSync, historical: false };
}
