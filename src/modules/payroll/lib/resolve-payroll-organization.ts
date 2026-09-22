import { prisma } from "@/lib/prisma";
import { resolveActorOrganizationId } from "@/src/modules/auth/lib/organization-scope";

/**
 * Resolve the organization for payroll operations.
 * Prefers the actor user's organization, then the session user's organization.
 * Legacy “oldest org” fallback only when ALLOW_LEGACY_ORG_FALLBACK=true (scripts).
 */
export async function resolvePayrollOrganization(input?: {
  actorUserId?: string | null;
  allowLegacyFallback?: boolean;
}): Promise<{ id: string; name: string; defaultCurrency: string }> {
  const organizationId = await resolveActorOrganizationId({
    actorUserId: input?.actorUserId,
    allowLegacyFallback: input?.allowLegacyFallback,
  });

  if (!organizationId) {
    throw new Error("No organization is configured for this user.");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true, name: true, defaultCurrency: true },
  });

  if (!organization) {
    throw new Error("No organization is configured for this user.");
  }

  return organization;
}

export async function assertPayRunInOrganization(
  payRunId: string,
  organizationId: string,
): Promise<boolean> {
  const run = await prisma.payRun.findFirst({
    where: { id: payRunId, organizationId },
    select: { id: true },
  });
  return Boolean(run);
}
