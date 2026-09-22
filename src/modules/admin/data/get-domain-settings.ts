import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";

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
  const __sessionOrganizationId = await getSessionOrganizationId();
  const organization = __sessionOrganizationId
    ? { id: __sessionOrganizationId }
    : null;

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
