import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrganizationHolidayDatesInRange } from "@/src/modules/hr/data/get-organization-holidays";
import { leaveBalanceCycleKey } from "@/src/modules/hr/lib/leave-balance-cycle-key";
import { calculateLeaveDays } from "@/src/modules/hr/services/calculate-leave-days";

export type ValidatedContractLeaveRequest = {
  employeeId: string;
  contractId: string;
  leaveTypeId: string;
  leaveBalanceId: string | null;
  requestedQuantity: Prisma.Decimal;
  requiresDocument: boolean;
  days: {
    leaveDate: Date;
    quantity: Prisma.Decimal;
    isWorkingDay: boolean;
    isPublicHoliday: boolean;
  }[];
};

export async function validateContractLeaveRequest({
  employeeId,
  contractId,
  leaveTypeId,
  startDate,
  endDate,
  skipNotice = false,
}: {
  employeeId: string;
  contractId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  /** When true, bypass minimumNoticeDays (historical / cutover entry). */
  skipNotice?: boolean;
}): Promise<ValidatedContractLeaveRequest> {
  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      employee: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!contract) {
    throw new Error("The selected employment contract is invalid.");
  }

  if (!contract.endDate) {
    throw new Error("The selected contract does not have an end date.");
  }

  if (startDate < contract.startDate || endDate > contract.endDate) {
    throw new Error(
      "The leave request must fall entirely within the selected contract period.",
    );
  }

  const leaveType = await prisma.leaveType.findFirst({
    where: {
      id: leaveTypeId,
      isActive: true,
    },
    select: {
      id: true,
      requiresBalance: true,
      allowsNegativeBalance: true,
      maximumConsecutiveDays: true,
      requiresDocument: true,
      documentRequiredAfter: true,
      minimumNoticeDays: true,
    },
  });

  if (!leaveType) {
    throw new Error("The selected leave type is invalid or inactive.");
  }

  if (!skipNotice && leaveType.minimumNoticeDays > 0) {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const noticeCutoff = new Date(todayUtc);
    noticeCutoff.setUTCDate(
      noticeCutoff.getUTCDate() + leaveType.minimumNoticeDays,
    );

    if (startDate < noticeCutoff) {
      throw new Error(
        `This leave type requires at least ${leaveType.minimumNoticeDays} day(s) notice.`,
      );
    }
  }

  const holidayDates = await getOrganizationHolidayDatesInRange({
    organizationId: contract.employee.organizationId,
    startDate,
    endDate,
  });

  const calculation = calculateLeaveDays({
    startDate,
    endDate,
    holidayDates,
  });

  if (calculation.requestedQuantity.lte(0)) {
    throw new Error("The selected dates do not include any working days.");
  }

  if (
    leaveType.maximumConsecutiveDays &&
    calculation.requestedQuantity.gt(leaveType.maximumConsecutiveDays)
  ) {
    throw new Error(
      `This leave type permits a maximum of ${leaveType.maximumConsecutiveDays.toString()} consecutive working days.`,
    );
  }

  const documentRequired =
    leaveType.requiresDocument &&
    (!leaveType.documentRequiredAfter ||
      calculation.requestedQuantity.gte(leaveType.documentRequiredAfter));

  const balance = await prisma.employeeLeaveBalance.findFirst({
    where: leaveBalanceCycleKey({
      contractId,
      leaveTypeId,
      cycleStart: contract.startDate,
      cycleEnd: contract.endDate,
    }),
    select: {
      id: true,
      availableBalance: true,
    },
  });

  if (leaveType.requiresBalance && !balance) {
    throw new Error(
      "No leave balance exists for this contract and leave type.",
    );
  }

  if (
    leaveType.requiresBalance &&
    balance &&
    !leaveType.allowsNegativeBalance &&
    calculation.requestedQuantity.gt(balance.availableBalance)
  ) {
    throw new Error(
      `The requested leave exceeds the available balance of ${balance.availableBalance.toString()} days.`,
    );
  }

  return {
    employeeId,
    contractId,
    leaveTypeId,
    leaveBalanceId: balance?.id ?? null,
    requestedQuantity: calculation.requestedQuantity,
    requiresDocument: documentRequired,
    days: calculation.days,
  };
}
