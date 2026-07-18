import { cache } from "react";

import {
  getApplicationChrome,
  type ApplicationChrome,
} from "@/src/modules/admin/data/get-application-chrome";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export type SessionContext = {
  user: SessionUser | null;
  capabilities: UserCapabilities | null;
  chrome: ApplicationChrome;
  organizationId: string | null;
};

/**
 * Single cached session bundle for layout + pages.
 * Prefer this over re-resolving user / capabilities / chrome separately.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const [user, capabilities, chrome] = await Promise.all([
    getCurrentUser(),
    getUserCapabilities(),
    getApplicationChrome(),
  ]);

  return {
    user,
    capabilities,
    chrome,
    organizationId: user?.organizationId ?? null,
  };
});
