import {
  ConfigurationStatus,
  OrganizationStatus,
  PrismaClient,
  RoleAssignmentStatus,
  SequenceResetFrequency,
  SettingDataType,
  UserAccountStatus,
} from "../generated/prisma/client";

const prisma = new PrismaClient();

const organizationId = "org-q-nxus-main";
const administratorRoleId = "role-system-administrator";
const administratorUserId = "user-devon-admin";

const permissions = [
  {
    code: "administration.view",
    name: "View administration",
    moduleKey: "administration",
  },
  {
    code: "administration.view_health",
    name: "View system health",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_organization",
    name: "Manage organizations",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_business_unit",
    name: "Manage business units",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_location",
    name: "Manage locations",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_reference_data",
    name: "Manage reference data",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_feature",
    name: "Manage feature controls",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_domain_setting",
    name: "Manage domain settings",
    moduleKey: "administration",
  },
  {
    code: "administration.manage_sequence",
    name: "Manage numbering sequences",
    moduleKey: "administration",
  },
  {
    code: "identity.user.view",
    name: "View users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.create",
    name: "Create users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.update",
    name: "Update users",
    moduleKey: "identity",
  },
  {
    code: "identity.user.suspend",
    name: "Suspend users",
    moduleKey: "identity",
  },
  {
    code: "identity.role.view",
    name: "View roles",
    moduleKey: "identity",
  },
  {
    code: "identity.role.manage",
    name: "Manage roles",
    moduleKey: "identity",
  },
  {
    code: "identity.permission.view",
    name: "View permissions",
    moduleKey: "identity",
  },
  {
    code: "audit.view",
    name: "View audit events",
    moduleKey: "audit",
  },
  {
    code: "notification.view_own",
    name: "View own notifications",
    moduleKey: "notifications",
  },
];

async function seedOrganization(): Promise<void> {
  await prisma.organization.upsert({
    where: {
      id: organizationId,
    },
    update: {
      code: "QNX",
      name: "Q-NXUS Demo Organization",
      shortName: "Q-NXUS",
      legalName: "Q-NXUS Demo Organization",
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      defaultTimeZone: "America/Port_of_Spain",
      defaultCurrency: "TTD",
      defaultLanguage: "en",
      dateFormat: "dd/MM/yyyy",
      firstDayOfWeek: 1,
    },
    create: {
      id: organizationId,
      code: "QNX",
      name: "Q-NXUS Demo Organization",
      shortName: "Q-NXUS",
      legalName: "Q-NXUS Demo Organization",
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      defaultTimeZone: "America/Port_of_Spain",
      defaultCurrency: "TTD",
      defaultLanguage: "en",
      dateFormat: "dd/MM/yyyy",
      firstDayOfWeek: 1,
    },
  });
}

async function seedApplicationSettings(): Promise<void> {
  const existing = await prisma.applicationSetting.findFirst();

  if (existing) {
    await prisma.applicationSetting.update({
      where: {
        id: existing.id,
      },
      data: {
        internalCodename: "Q-NXUS",
        displayName: "Q-NXUS",
        shortName: "Q-NXUS",
        organizationName: "Q-NXUS Demo Organization",
      },
    });

    return;
  }

  await prisma.applicationSetting.create({
    data: {
      internalCodename: "Q-NXUS",
      displayName: "Q-NXUS",
      shortName: "Q-NXUS",
      organizationName: "Q-NXUS Demo Organization",
    },
  });
}

async function seedBusinessUnits(): Promise<void> {
  await prisma.businessUnit.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "CORPORATE",
      },
    },
    update: {
      name: "Corporate Services",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      code: "CORPORATE",
      name: "Corporate Services",
      description: "Corporate and shared administrative services.",
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await prisma.businessUnit.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "OPERATIONS",
      },
    },
    update: {
      name: "Operations",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      code: "OPERATIONS",
      name: "Operations",
      description: "Core operational business services.",
      status: ConfigurationStatus.ACTIVE,
    },
  });
}

async function seedLocations(): Promise<void> {
  await prisma.location.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "HEAD-OFFICE",
      },
    },
    update: {
      name: "Head Office",
      locationType: "OFFICE",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      code: "HEAD-OFFICE",
      name: "Head Office",
      locationType: "OFFICE",
      countryCode: "TT",
      timeZone: "America/Port_of_Spain",
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await prisma.location.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "REMOTE",
      },
    },
    update: {
      name: "Remote",
      locationType: "REMOTE",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      code: "REMOTE",
      name: "Remote",
      locationType: "REMOTE",
      countryCode: "TT",
      timeZone: "America/Port_of_Spain",
      status: ConfigurationStatus.ACTIVE,
    },
  });
}

async function seedReferenceData(): Promise<void> {
  const locationTypeSet = await prisma.referenceDataSet.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "LOCATION_TYPE",
      },
    },
    update: {
      name: "Location Types",
      moduleKey: "administration",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      code: "LOCATION_TYPE",
      name: "Location Types",
      description: "Valid types of Organization locations.",
      moduleKey: "administration",
      status: ConfigurationStatus.ACTIVE,
    },
  });

  const locationTypes = [
    ["OFFICE", "Office", 10],
    ["BRANCH", "Branch", 20],
    ["WAREHOUSE", "Warehouse", 30],
    ["WORK_SITE", "Work Site", 40],
    ["REMOTE", "Remote", 50],
    ["DATA_CENTRE", "Data Centre", 60],
  ] as const;

  for (const [code, label, sortOrder] of locationTypes) {
    await prisma.referenceDataValue.upsert({
      where: {
        dataSetId_code: {
          dataSetId: locationTypeSet.id,
          code,
        },
      },
      update: {
        label,
        sortOrder,
        status: ConfigurationStatus.ACTIVE,
      },
      create: {
        dataSetId: locationTypeSet.id,
        code,
        label,
        sortOrder,
        status: ConfigurationStatus.ACTIVE,
      },
    });
  }
}

async function seedFeatureControls(): Promise<void> {
  const features = [
    ["people", true],
    ["payroll", true],
    ["leave", true],
    ["recruitment", true],
    ["onboarding", true],
    ["offboarding", true],
    ["assets", true],
    ["workflow", true],
    ["notifications", true],
    ["reporting", true],
  ] as const;

  for (const [featureCode, isEnabled] of features) {
    await prisma.featureControl.upsert({
      where: {
        organizationId_featureCode: {
          organizationId,
          featureCode,
        },
      },
      update: {
        isEnabled,
        status: ConfigurationStatus.ACTIVE,
      },
      create: {
        organizationId,
        featureCode,
        isEnabled,
        status: ConfigurationStatus.ACTIVE,
        reason: "Initial Q-NXUS platform configuration.",
      },
    });
  }
}

async function seedDomainSettings(): Promise<void> {
  const settings = [
    {
      settingCode: "platform.organization_name",
      moduleKey: "core",
      name: "Organization name",
      dataType: SettingDataType.STRING,
      value: "Q-NXUS Demo Organization",
    },
    {
      settingCode: "platform.time_zone",
      moduleKey: "core",
      name: "Default time zone",
      dataType: SettingDataType.STRING,
      value: "America/Port_of_Spain",
    },
    {
      settingCode: "platform.currency",
      moduleKey: "core",
      name: "Default currency",
      dataType: SettingDataType.STRING,
      value: "TTD",
    },
    {
      settingCode: "identity.mfa_required",
      moduleKey: "identity",
      name: "Require multi-factor authentication",
      dataType: SettingDataType.BOOLEAN,
      value: false,
    },
  ] as const;

  for (const setting of settings) {
    await prisma.domainSetting.upsert({
      where: {
        organizationId_settingCode: {
          organizationId,
          settingCode: setting.settingCode,
        },
      },
      update: {
        moduleKey: setting.moduleKey,
        name: setting.name,
        dataType: setting.dataType,
        value: setting.value,
        status: ConfigurationStatus.ACTIVE,
      },
      create: {
        organizationId,
        settingCode: setting.settingCode,
        moduleKey: setting.moduleKey,
        name: setting.name,
        dataType: setting.dataType,
        value: setting.value,
        status: ConfigurationStatus.ACTIVE,
      },
    });
  }
}

async function seedNumberingSequences(): Promise<void> {
  const sequences = [
    {
      sequenceCode: "EMPLOYEE",
      prefix: "EMP-",
      minimumLength: 5,
      resetFrequency: SequenceResetFrequency.NEVER,
    },
    {
      sequenceCode: "CONTRACT",
      prefix: "CON-",
      minimumLength: 5,
      resetFrequency: SequenceResetFrequency.ANNUALLY,
    },
    {
      sequenceCode: "LEAVE_REQUEST",
      prefix: "LVR-",
      minimumLength: 6,
      resetFrequency: SequenceResetFrequency.ANNUALLY,
    },
    {
      sequenceCode: "PAY_RUN",
      prefix: "PAY-",
      minimumLength: 6,
      resetFrequency: SequenceResetFrequency.ANNUALLY,
    },
    {
      sequenceCode: "ASSET",
      prefix: "AST-",
      minimumLength: 6,
      resetFrequency: SequenceResetFrequency.NEVER,
    },
  ];

  for (const sequence of sequences) {
    await prisma.numberingSequence.upsert({
      where: {
        organizationId_sequenceCode: {
          organizationId,
          sequenceCode: sequence.sequenceCode,
        },
      },
      update: {
        prefix: sequence.prefix,
        minimumLength: sequence.minimumLength,
        resetFrequency: sequence.resetFrequency,
        isActive: true,
      },
      create: {
        organizationId,
        sequenceCode: sequence.sequenceCode,
        prefix: sequence.prefix,
        minimumLength: sequence.minimumLength,
        resetFrequency: sequence.resetFrequency,
        isActive: true,
      },
    });
  }
}

async function seedPermissions(): Promise<void> {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        moduleKey: permission.moduleKey,
        isActive: true,
      },
      create: {
        code: permission.code,
        name: permission.name,
        moduleKey: permission.moduleKey,
        isActive: true,
      },
    });
  }
}

async function seedRoles(): Promise<void> {
  await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "SYSTEM_ADMINISTRATOR",
      },
    },
    update: {
      name: "System Administrator",
      description: "Full platform administration access.",
      isSystem: true,
      isActive: true,
    },
    create: {
      id: administratorRoleId,
      organizationId,
      code: "SYSTEM_ADMINISTRATOR",
      name: "System Administrator",
      description: "Full platform administration access.",
      isSystem: true,
      isActive: true,
    },
  });

  await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "HR_ADMINISTRATOR",
      },
    },
    update: {
      name: "HR Administrator",
      isActive: true,
    },
    create: {
      organizationId,
      code: "HR_ADMINISTRATOR",
      name: "HR Administrator",
      description: "Administration of People and workforce records.",
      isActive: true,
    },
  });

  await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "EMPLOYEE",
      },
    },
    update: {
      name: "Employee",
      isActive: true,
    },
    create: {
      organizationId,
      code: "EMPLOYEE",
      name: "Employee",
      description: "Standard Employee self-service access.",
      isActive: true,
    },
  });
}

async function seedRolePermissions(): Promise<void> {
  const administratorRole = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_code: {
        organizationId,
        code: "SYSTEM_ADMINISTRATOR",
      },
    },
  });

  const allPermissions = await prisma.permission.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: administratorRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: administratorRole.id,
        permissionId: permission.id,
      },
    });
  }
}

async function seedAdministrator(): Promise<void> {
  const administrator = await prisma.user.upsert({
    where: {
      email: "admin@q-nxus.local",
    },
    update: {
      organizationId,
      firstName: "Devon",
      lastName: "Administrator",
      status: UserAccountStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      id: administratorUserId,
      organizationId,
      email: "admin@q-nxus.local",
      firstName: "Devon",
      lastName: "Administrator",
      status: UserAccountStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const administratorRole = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_code: {
        organizationId,
        code: "SYSTEM_ADMINISTRATOR",
      },
    },
  });

  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: administrator.id,
      roleId: administratorRole.id,
      status: RoleAssignmentStatus.ACTIVE,
    },
  });

  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: administrator.id,
        roleId: administratorRole.id,
        status: RoleAssignmentStatus.ACTIVE,
        effectiveFrom: new Date(),
        reason: "Initial Q-NXUS system administrator.",
      },
    });
  }
}

async function seedModuleStatuses(): Promise<void> {
  const modules = [
    ["core", "Core Platform"],
    ["administration", "Administration"],
    ["identity", "Identity and Access"],
    ["people", "People"],
    ["payroll", "Payroll"],
    ["notifications", "Notifications"],
    ["audit", "Audit"],
  ] as const;

  for (const [moduleKey, moduleName] of modules) {
    await prisma.moduleStatus.upsert({
      where: {
        moduleKey,
      },
      update: {
        moduleName,
      },
      create: {
        moduleKey,
        moduleName,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log("Seeding Q-NXUS platform foundation...");

  await seedOrganization();
  await seedApplicationSettings();
  await seedBusinessUnits();
  await seedLocations();
  await seedReferenceData();
  await seedFeatureControls();
  await seedDomainSettings();
  await seedNumberingSequences();
  await seedPermissions();
  await seedRoles();
  await seedRolePermissions();
  await seedAdministrator();
  await seedModuleStatuses();

  console.log("Q-NXUS platform foundation seeded successfully.");
  console.log("Initial administrator: admin@q-nxus.local");
}

main()
  .catch((error: unknown) => {
    console.error("Q-NXUS seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
