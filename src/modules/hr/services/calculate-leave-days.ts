import { Prisma } from "@/generated/prisma/client"

export type CalculatedLeaveDay = {
  leaveDate: Date
  quantity: Prisma.Decimal
  isWorkingDay: boolean
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  )
}

export function calculateLeaveDays({
  startDate,
  endDate,
}: {
  startDate: Date
  endDate: Date
}): {
  days: CalculatedLeaveDay[]
  requestedQuantity: Prisma.Decimal
} {
  const start = startOfUtcDay(startDate)
  const end = startOfUtcDay(endDate)

  if (end < start) {
    throw new Error(
      "Leave end date cannot be before the start date.",
    )
  }

  const days: CalculatedLeaveDay[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay()
    const isWorkingDay =
      dayOfWeek !== 0 && dayOfWeek !== 6

    days.push({
      leaveDate: new Date(cursor),
      quantity: new Prisma.Decimal(
        isWorkingDay ? 1 : 0,
      ),
      isWorkingDay,
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const requestedQuantity = days.reduce(
    (total, day) => total.plus(day.quantity),
    new Prisma.Decimal(0),
  )

  return {
    days,
    requestedQuantity,
  }
}
