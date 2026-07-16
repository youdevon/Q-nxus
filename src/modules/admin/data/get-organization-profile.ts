import { prisma } from "@/lib/prisma"

export type OrganizationProfile = {
  id: string
  code: string
  name: string
  shortName: string | null
  legalName: string | null
  email: string | null
  phone: string | null
  website: string | null
  status: string
  defaultTimeZone: string
  defaultCurrency: string
  defaultLanguage: string
  dateFormat: string
  firstDayOfWeek: number
  version: number
  isActive: boolean
  updatedAt: Date
}

export async function getOrganizationProfile(): Promise<OrganizationProfile | null> {
  return prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      shortName: true,
      legalName: true,
      email: true,
      phone: true,
      website: true,
      status: true,
      defaultTimeZone: true,
      defaultCurrency: true,
      defaultLanguage: true,
      dateFormat: true,
      firstDayOfWeek: true,
      version: true,
      isActive: true,
      updatedAt: true,
    },
  })
}
