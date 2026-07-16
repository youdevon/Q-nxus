import { prisma } from "@/lib/prisma";

export type DomainSettingRecord = {
  id: string;
  settingCode: string;
  moduleKey: string;
  name: string;
  description: string | null;
  dataType: string;
  value: unknown;
  isSensitive: boolean;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  version: number;
  updatedAt: Date;
};

export async function getDomainSettings(): Promise<DomainSettingRecord[]> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  return prisma.domainSetting.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: [
      {
        moduleKey: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      settingCode: true,
      moduleKey: true,
      name: true,
      description: true,
      dataType: true,
      value: true,
      isSensitive: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      version: true,
      updatedAt: true,
    },
  });
}
