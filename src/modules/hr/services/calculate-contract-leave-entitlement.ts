import { Prisma } from "@/generated/prisma/client"

const MONTHS_PER_YEAR = 12

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  )
}

function inclusiveContractMonths(
  startDate: Date,
  endDate: Date,
): number {
  const start = startOfUtcDay(startDate)
  const end = startOfUtcDay(endDate)

  if (end < start) {
    throw new Error(
      "Contract end date cannot be before its start date.",
    )
  }

  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) *
      12 +
    (end.getUTCMonth() - start.getUTCMonth())

  const partialMonth =
    end.getUTCDate() >= start.getUTCDate() ? 1 : 0

  return Math.max(1, months + partialMonth)
}

function roundLeaveQuantity(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateContractLeaveEntitlement({
  annualEntitlement,
  contractStart,
  contractEnd,
  prorate,
}: {
  annualEntitlement: Prisma.Decimal | number | string
  contractStart: Date
  contractEnd: Date
  prorate: boolean
}): Prisma.Decimal {
  const annual = Number(annualEntitlement)

  if (!Number.isFinite(annual) || annual < 0) {
    throw new Error(
      "Annual leave entitlement must be a valid non-negative number.",
    )
  }

  if (!prorate) {
    return new Prisma.Decimal(
      roundLeaveQuantity(annual),
    )
  }

  const contractMonths = inclusiveContractMonths(
    contractStart,
    contractEnd,
  )

  const entitlement =
    annual *
    Math.min(contractMonths, MONTHS_PER_YEAR) /
    MONTHS_PER_YEAR

  return new Prisma.Decimal(
    roundLeaveQuantity(entitlement),
  )
}
