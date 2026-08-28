import { prisma } from "@/lib/prisma";
import {
  evaluateVacationForfeitureAlert,
  VACATION_FORFEITURE_NOTICE_DAYS,
  VACATION_LEAVE_TYPE_CODE,
  type VacationForfeitureAlert,
} from "@/src/modules/hr/lib/vacation-forfeiture";

export type VacationForfeitureQueueItem = VacationForfeitureAlert & {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  contractId: string;
  contractNumber: string | null;
  jobTitle: string;
};

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Org-wide list of current contracts in the vacation use-or-lose window.
 * For HR leave workspace monitoring (no notification side effects).
 */
export async function getVacationForfeitureQueue(
  organizationId: string,
  asOf: Date = new Date(),
  limit = 25,
): Promise<VacationForfeitureQueueItem[]> {
  const today = startOfUtcDay(asOf);
  const windowEnd = addUtcDays(today, VACATION_FORFEITURE_NOTICE_DAYS);
  const candidateCap = Math.min(Math.max(limit * 4, 40), 120);

  const balances = await prisma.employeeLeaveBalance.findMany({
    where: {
      availableBalance: { gt: 0 },
      leaveType: {
        code: VACATION_LEAVE_TYPE_CODE,
        isActive: true,
      },
      contract: {
        isCurrent: true,
        status: { in: ["ACTIVE", "EXPIRED"] },
        // Include already-ended contracts (daysUntilEnd < 0) and those ending
        // within the notice window — push the filter into SQL before take.
        endDate: { not: null, lte: windowEnd },
        employee: {
          organizationId,
          isArchived: false,
        },
      },
    },
    select: {
      availableBalance: true,
      employeeId: true,
      contractId: true,
      contract: {
        select: {
          id: true,
          endDate: true,
          contractNumber: true,
          jobTitle: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
      },
    },
    orderBy: {
      contract: {
        endDate: "asc",
      },
    },
    take: candidateCap,
  });

  const items: VacationForfeitureQueueItem[] = [];

  for (const balance of balances) {
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: balance.availableBalance.toString(),
      contractEndDate: balance.contract.endDate,
      asOf: today,
    });

    if (!alert) {
      continue;
    }

    const employee = balance.contract.employee;
    items.push({
      ...alert,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName:
        `${employee.preferredName ?? employee.firstName} ${employee.lastName}`.trim(),
      contractId: balance.contract.id,
      contractNumber: balance.contract.contractNumber,
      jobTitle: balance.contract.jobTitle,
    });
  }

  return items.slice(0, limit);
}
