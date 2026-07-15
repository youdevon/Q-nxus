import { prisma } from "@/lib/prisma"

export type FeatureControlRecord = {
  id: string
  featureCode: string
  isEnabled: boolean
  status: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  reason: string | null
  updatedAt: Date
}

export async function getFeatureControls(): Promise<FeatureControlRecord[]> {
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

  return prisma.featureControl.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      featureCode: "asc",
    },
    select: {
      id: true,
      featureCode: true,
      isEnabled: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      reason: true,
      updatedAt: true,
    },
  })
}
