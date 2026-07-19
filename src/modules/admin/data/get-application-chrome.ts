import { cache } from "react";

import { appConfig } from "@/src/config/app.config";
import { prisma } from "@/lib/prisma";

/**
 * Live chrome for sidebar / shell / email branding.
 *
 * Customer org identity SoT is Organization (admin Organization form).
 * Product/software label stays on appConfig (not the seeded Q-NXUS demo name).
 * ApplicationSetting may still mirror name/shortName on org save for legacy
 * readers, but chrome must prefer Organization and only fall back to settings.
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
    const [organization, settings] = await Promise.all([
      prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          shortName: true,
          legalName: true,
          code: true,
        },
      }),
      prisma.applicationSetting.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          shortName: true,
          organizationName: true,
        },
      }),
    ]);

    const organizationName =
      organization?.name?.trim() ||
      organization?.legalName?.trim() ||
      settings?.organizationName?.trim() ||
      appConfig.organizationName;

    const organizationCode =
      organization?.code?.trim() || appConfig.shortName;

    const shortName =
      organization?.shortName?.trim() ||
      organization?.code?.trim() ||
      settings?.shortName?.trim() ||
      appConfig.shortName;

    return {
      displayName: appConfig.displayName,
      shortName,
      organizationName,
      organizationCode,
    };
  },
);
