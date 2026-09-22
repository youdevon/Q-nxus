import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

/**
 * Organization for the signed-in user (from User.organizationId).
 * Fail closed — never invent a tenant from “oldest org” on request paths.
 */
export const getSessionOrganizationId = cache(
  async (): Promise<string | null> => {
    const user = await getCurrentUser();
    return user?.organizationId ?? null;
  },
);

export async function requireSessionOrganizationId(): Promise<string> {
  const organizationId = await getSessionOrganizationId();
  if (!organizationId) {
    throw new Error(
      "No organization is associated with this session. Sign in again or contact an administrator.",
    );
  }
  return organizationId;
}

/**
 * Session org id for request-scoped loaders — null if unauthenticated / no org.
 * Prefer this over inventing a tenant when returning empty/not-found is correct.
 */
export async function getRequestOrganizationId(): Promise<string | null> {
  return getSessionOrganizationId();
}

/**
 * Seeds, CLI scripts, and background jobs only.
 * Request handlers must use getSessionOrganizationId / requireSessionOrganizationId.
 */
export async function getLegacyOldestOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return organization?.id ?? null;
}

/**
 * Prefer actor user’s org; then session; optional legacy fallback for scripts.
 */
export async function resolveActorOrganizationId(input?: {
  actorUserId?: string | null;
  allowLegacyFallback?: boolean;
}): Promise<string | null> {
  if (input?.actorUserId) {
    const user = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { organizationId: true },
    });
    if (user?.organizationId) {
      return user.organizationId;
    }
  }

  const sessionOrgId = await getSessionOrganizationId();
  if (sessionOrgId) {
    return sessionOrgId;
  }

  if (
    input?.allowLegacyFallback ||
    process.env.ALLOW_LEGACY_ORG_FALLBACK === "true"
  ) {
    return getLegacyOldestOrganizationId();
  }

  return null;
}
