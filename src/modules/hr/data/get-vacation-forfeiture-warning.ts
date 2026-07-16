import { prisma } from "@/lib/prisma";
import {
  evaluateVacationForfeitureAlert,
  formatVacationForfeitureMessage,
  VACATION_LEAVE_TYPE_CODE,
  type VacationForfeitureAlert,
} from "@/src/modules/hr/lib/vacation-forfeiture";

export type VacationForfeitureWarning = VacationForfeitureAlert & {
  message: string;
};

/** Lightweight read for UI banners (no notification side effects). */
export async function getVacationForfeitureWarningForEmployee(
  employeeId: string,
  asOf: Date = new Date(),
): Promise<VacationForfeitureWarning | null> {
  const [vacationBalance, currentContract] = await Promise.all([
    prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId,
        contract: { isCurrent: true },
        leaveType: {
          code: VACATION_LEAVE_TYPE_CODE,
          isActive: true,
        },
      },
      select: { availableBalance: true },
    }),
    prisma.employmentContract.findFirst({
      where: {
        employeeId,
        isCurrent: true,
      },
      select: { endDate: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const alert = evaluateVacationForfeitureAlert({
    availableVacation: vacationBalance?.availableBalance.toString() ?? "0",
    contractEndDate: currentContract?.endDate ?? null,
    asOf,
  });

  if (!alert) {
    return null;
  }

  return {
    ...alert,
    message: formatVacationForfeitureMessage(alert),
  };
}
