import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";

export type OrganizationProfile = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  defaultTimeZone: string;
  defaultCurrency: string;
  defaultLanguage: string;
  dateFormat: string;
  firstDayOfWeek: number;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

/** Deduped per React request — layout chrome + org page share one lookup. */
export const getOrganizationProfile = cache(
  async (): Promise<OrganizationProfile | null> => {
    const sessionOrgId = await getSessionOrganizationId();
    if (!sessionOrgId) {
      return null;
    }

    return prisma.organization.findFirst({
      where: { id: sessionOrgId },
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
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
      },
    });
  },
);
