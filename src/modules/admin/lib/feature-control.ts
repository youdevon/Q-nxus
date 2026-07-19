import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * Runtime feature flag gate. FeatureControl rows are organization-scoped.
 *
 * @param defaultEnabled — used when the org has no row for this code.
 *   Defaults to **true** for backward compatibility with non-banking modules.
 *   Dangerous payroll banking flags must pass **false** (via
 *   `isPayrollBankingFeatureEnabled`) so a missing seed row does not enable ACH.
 */
async function loadFeatureEnabled(
  featureCode: string,
  defaultEnabled: boolean,
): Promise<boolean> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    return defaultEnabled;
  }

  const control = await prisma.featureControl.findFirst({
    where: {
      organizationId: organization.id,
      featureCode,
    },
    select: {
      isEnabled: true,
    },
  });

  if (!control) {
    return defaultEnabled;
  }

  return control.isEnabled;
}

const isFeatureEnabledCached = cache(
  async (featureCode: string, defaultEnabled: boolean): Promise<boolean> =>
    loadFeatureEnabled(featureCode, defaultEnabled),
);

export async function isFeatureEnabled(
  featureCode: string,
  defaultEnabled: boolean = true,
): Promise<boolean> {
  return isFeatureEnabledCached(featureCode, defaultEnabled);
}
