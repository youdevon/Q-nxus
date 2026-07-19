import { prisma } from "@/lib/prisma";

export type AdministrationDashboardData = {
  organization: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    legalName: string | null;
    status: string;
    defaultTimeZone: string;
    defaultCurrency: string;
    defaultLanguage: string;
  } | null;
  counts: {
    users: number;
    activeUsers: number;
    roles: number;
    permissions: number;
  };
  moduleStatuses: Array<{
    id: string;
    moduleKey: string;
    moduleName: string;
    health: string;
    message: string | null;
    checkedAt: Date;
  }>;
  readiness: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
};

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
  });

  if (!organization) {
    return {
      organization: null,
      counts: {
        users: 0,
        activeUsers: 0,
        roles: 0,
        permissions: 0,
      },
      moduleStatuses: [],
      readiness: [
        {
          key: "organization",
          label: "Organization",
          ready: false,
          detail: "No Organization has been configured.",
        },
      ],
    };
  }

  const [
    users,
    activeUsers,
    roles,
    permissions,
    moduleStatuses,
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
    prisma.permission.count({
      where: {
        isActive: true,
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
    prisma.numberingSequence.count({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
    }),
    prisma.applicationSetting.count(),
  ]);

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
  ];

  return {
    organization,
    counts: {
      users,
      activeUsers,
      roles,
      permissions,
    },
    moduleStatuses,
    readiness,
  };
}
