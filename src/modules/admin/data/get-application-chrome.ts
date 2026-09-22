import { cache } from "react";

import { appConfig } from "@/src/config/app.config";
import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";

/**
 * Live chrome for sidebar / shell / email branding.
 *
 * Customer org identity SoT is Organization (admin Organization form).
 * Product/software label stays on appConfig.
 */
export type ApplicationChrome = {
  /** Product/software label (generic platform name). */
  displayName: string;
  /** Compact org label for sidebar and tight chrome — Organization.shortName. */
  shortName: string;
  /** Full customer organization name. */
  organizationName: string;
  /** Organization code from admin settings. */
  organizationCode: string;
};

export const getApplicationChrome = cache(
  async (): Promise<ApplicationChrome> => {
    const organizationId = await getSessionOrganizationId();
    const organization = organizationId
      ? await prisma.organization.findFirst({
          where: { id: organizationId },
          select: {
            name: true,
            shortName: true,
            legalName: true,
            code: true,
          },
        })
      : null;

    const organizationName =
      organization?.name?.trim() ||
      organization?.legalName?.trim() ||
      appConfig.organizationName;

    const organizationCode =
      organization?.code?.trim() || appConfig.shortName;

    const shortName =
      organization?.shortName?.trim() ||
      organization?.code?.trim() ||
      appConfig.shortName;

    return {
      displayName: appConfig.displayName,
      shortName,
      organizationName,
      organizationCode,
    };
  },
);
