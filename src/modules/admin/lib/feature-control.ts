import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";

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
  const organizationId = await getSessionOrganizationId();

  if (!organizationId) {
    return defaultEnabled;
  }

  const control = await prisma.featureControl.findFirst({
    where: {
      organizationId,
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
