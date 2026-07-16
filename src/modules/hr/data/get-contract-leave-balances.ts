import { prisma } from "@/lib/prisma"

export type ContractLeaveBalanceRecord = {
  id: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  contractId: string
  contractNumber: string | null
  cycleStart: string
  cycleEnd: string
  leaveTypeCode: string
  leaveTypeName: string
  entitlement: string
  accrued: string
  carriedForward: string
  adjustments: string
  reserved: string
  taken: string
  expired: string
  availableBalance: string
}

export async function getContractLeaveBalances(): Promise<
  ContractLeaveBalanceRecord[]
> {
  const balances =
    await prisma.employeeLeaveBalance.findMany({
      orderBy: [
        {
          employee: {
            lastName: "asc",
          },
        },
        {
          employee: {
            firstName: "asc",
          },
        },
        {
          cycleStart: "desc",
        },
        {
          leaveType: {
            sortOrder: "asc",
          },
        },
      ],
      select: {
        id: true,
        employeeId: true,
        contractId: true,
        cycleStart: true,
        cycleEnd: true,
        entitlement: true,
        accrued: true,
        carriedForward: true,
        adjustments: true,
        reserved: true,
        taken: true,
        expired: true,
        availableBalance: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        contract: {
          select: {
            contractNumber: true,
          },
        },
        leaveType: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    })

  return balances.map((balance) => ({
    id: balance.id,
    employeeId: balance.employeeId,
    employeeNumber: balance.employee.employeeNumber,
    employeeName:
      `${balance.employee.firstName} ${balance.employee.lastName}`,
    contractId: balance.contractId,
    contractNumber:
      balance.contract.contractNumber,
    cycleStart: balance.cycleStart.toISOString(),
    cycleEnd: balance.cycleEnd.toISOString(),
    leaveTypeCode: balance.leaveType.code,
    leaveTypeName: balance.leaveType.name,
    entitlement: balance.entitlement.toString(),
    accrued: balance.accrued.toString(),
    carriedForward:
      balance.carriedForward.toString(),
    adjustments: balance.adjustments.toString(),
    reserved: balance.reserved.toString(),
    taken: balance.taken.toString(),
    expired: balance.expired.toString(),
    availableBalance:
      balance.availableBalance.toString(),
  }))
}
