import { prisma } from "@/lib/prisma"

export type AdministrationDashboardData = {
  organization: {
    id: string
    code: string
    name: string
    shortName: string | null
    legalName: string | null
    status: string
    defaultTimeZone: string
    defaultCurrency: string
    defaultLanguage: string
  } | null
  counts: {
    users: number
    activeUsers: number
    roles: number
    locations: number
    businessUnits: number
    permissions: number
    enabledFeatures: number
    totalFeatures: number
  }
  moduleStatuses: Array<{
    id: string
    moduleKey: string
    moduleName: string
    health: string
    message: string | null
    checkedAt: Date
  }>
  features: Array<{
    id: string
    featureCode: string
    isEnabled: boolean
    status: string
  }>
  readiness: Array<{
    key: string
    label: string
    ready: boolean
    detail: string
  }>
}

export async function getAdministrationDashboard(): Promise<AdministrationDashboardData> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      shortName: true,
      legalName: true,
      status: true,
      defaultTimeZone: true,
      defaultCurrency: true,
      defaultLanguage: true,
    },
  })

  if (!organization) {
    return {
      organization: null,
      counts: {
        users: 0,
        activeUsers: 0,
        roles: 0,
        locations: 0,
        businessUnits: 0,
        permissions: 0,
        enabledFeatures: 0,
        totalFeatures: 0,
      },
      moduleStatuses: [],
      features: [],
      readiness: [
        {
          key: "organization",
          label: "Organization",
          ready: false,
          detail: "No Organization has been configured.",
        },
      ],
    }
  }

  const [
    users,
    activeUsers,
    roles,
    locations,
    businessUnits,
    permissions,
    enabledFeatures,
    totalFeatures,
    moduleStatuses,
    features,
    numberingSequences,
    applicationSettings,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        organizationId: organization.id,
      },
    }),
    prisma.user.count({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
    }),
    prisma.role.count({
      where: {
        OR: [
          {
            organizationId: organization.id,
          },
          {
            organizationId: null,
          },
        ],
      },
    }),
    prisma.location.count({
      where: {
        organizationId: organization.id,
      },
    }),
    prisma.businessUnit.count({
      where: {
        organizationId: organization.id,
      },
    }),
    prisma.permission.count({
      where: {
        isActive: true,
      },
    }),
    prisma.featureControl.count({
      where: {
        organizationId: organization.id,
        isEnabled: true,
      },
    }),
    prisma.featureControl.count({
      where: {
        organizationId: organization.id,
      },
    }),
    prisma.moduleStatus.findMany({
      orderBy: {
        moduleName: "asc",
      },
      select: {
        id: true,
        moduleKey: true,
        moduleName: true,
        health: true,
        message: true,
        checkedAt: true,
      },
    }),
    prisma.featureControl.findMany({
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
      },
    }),
    prisma.numberingSequence.count({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
    }),
    prisma.applicationSetting.count(),
  ])

  const readiness = [
    {
      key: "organization",
      label: "Organization profile",
      ready: organization.status === "ACTIVE",
      detail:
        organization.status === "ACTIVE"
          ? "The Organization is active."
          : `Current status: ${organization.status}.`,
    },
    {
      key: "users",
      label: "Administrator account",
      ready: activeUsers > 0,
      detail:
        activeUsers > 0
          ? `${activeUsers} active user account${activeUsers === 1 ? "" : "s"}.`
          : "No active user account exists.",
    },
    {
      key: "roles",
      label: "Security roles",
      ready: roles > 0 && permissions > 0,
      detail:
        roles > 0 && permissions > 0
          ? `${roles} roles and ${permissions} permissions configured.`
          : "Roles or permissions are missing.",
    },
    {
      key: "locations",
      label: "Locations",
      ready: locations > 0,
      detail:
        locations > 0
          ? `${locations} location${locations === 1 ? "" : "s"} configured.`
          : "No locations are configured.",
    },
    {
      key: "business-units",
      label: "Business units",
      ready: businessUnits > 0,
      detail:
        businessUnits > 0
          ? `${businessUnits} business unit${businessUnits === 1 ? "" : "s"} configured.`
          : "No business units are configured.",
    },
    {
      key: "numbering",
      label: "Numbering sequences",
      ready: numberingSequences > 0,
      detail:
        numberingSequences > 0
          ? `${numberingSequences} active numbering sequence${numberingSequences === 1 ? "" : "s"}.`
          : "No active numbering sequences exist.",
    },
    {
      key: "application-settings",
      label: "Application settings",
      ready: applicationSettings > 0,
      detail:
        applicationSettings > 0
          ? "Application identity settings are available."
          : "Application settings have not been created.",
    },
  ]

  return {
    organization,
    counts: {
      users,
      activeUsers,
      roles,
      locations,
      businessUnits,
      permissions,
      enabledFeatures,
      totalFeatures,
    },
    moduleStatuses,
    features,
    readiness,
  }
}
