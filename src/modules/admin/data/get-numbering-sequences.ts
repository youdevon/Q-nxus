import { prisma } from "@/lib/prisma"

export type NumberingSequenceRecord = {
  id: string
  sequenceCode: string
  prefix: string | null
  suffix: string | null
  currentNumber: string
  minimumLength: number
  resetFrequency: string
  lastResetAt: Date | null
  isActive: boolean
  version: number
  updatedAt: Date
}

export async function getNumberingSequences(): Promise<
  NumberingSequenceRecord[]
> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  if (!organization) {
    return []
  }

  const sequences = await prisma.numberingSequence.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      sequenceCode: "asc",
    },
    select: {
      id: true,
      sequenceCode: true,
      prefix: true,
      suffix: true,
      currentNumber: true,
      minimumLength: true,
      resetFrequency: true,
      lastResetAt: true,
      isActive: true,
      version: true,
      updatedAt: true,
    },
  })

  return sequences.map((sequence) => ({
    ...sequence,
    currentNumber: sequence.currentNumber.toString(),
  }))
}
