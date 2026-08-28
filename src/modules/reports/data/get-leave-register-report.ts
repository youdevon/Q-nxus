import { prisma } from "@/lib/prisma";
import { LeaveRequestStatus } from "@/generated/prisma/client";

export type LeaveRegisterRow = {
  id: string;
  requestNumber: string | null;
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  leaveTypeCode: string;
  leaveTypeName: string;
  isPaid: boolean;
  startDate: string;
  endDate: string;
  requestedQuantity: string;
  approvedAt: string | null;
};

export type LeaveRegisterReport = {
  dateFrom: string;
  dateTo: string;
  rows: LeaveRegisterRow[];
};

function parseDateParam(value: string | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return fallback.toISOString().slice(0, 10);
}

/** Approved leave overlapping the selected date range. */
export async function getLeaveRegisterReport(input?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<LeaveRegisterReport> {
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const dateFrom = parseDateParam(input?.dateFrom, defaultFrom);
  const dateTo = parseDateParam(input?.dateTo, defaultTo);

  const rangeStart = new Date(`${dateFrom}T00:00:00.000Z`);
  const rangeEnd = new Date(`${dateTo}T23:59:59.999Z`);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: LeaveRequestStatus.APPROVED,
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
    select: {
      id: true,
      requestNumber: true,
      startDate: true,
      endDate: true,
      requestedQuantity: true,
      approvedAt: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: {
        select: { code: true, name: true, isPaid: true },
      },
    },
  });

  return {
    dateFrom,
    dateTo,
    rows: requests.map((request) => ({
      id: request.id,
      requestNumber: request.requestNumber,
      employeeId: request.employee.id,
      employeeNumber: request.employee.employeeNumber,
      displayName: `${request.employee.firstName} ${request.employee.lastName}`.trim(),
      departmentName: request.employee.department?.name ?? null,
      leaveTypeCode: request.leaveType.code,
      leaveTypeName: request.leaveType.name,
      isPaid: request.leaveType.isPaid,
      startDate: request.startDate.toISOString().slice(0, 10),
      endDate: request.endDate.toISOString().slice(0, 10),
      requestedQuantity: request.requestedQuantity.toString(),
      approvedAt: request.approvedAt?.toISOString() ?? null,
    })),
  };
}
