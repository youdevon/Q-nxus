import { prisma } from "@/lib/prisma";

/**
 * Resolve the organization for payroll operations.
 * Prefers the actor user's organization; falls back to the oldest org
 * (legacy single-tenant scripts without a user context).
 */
export async function resolvePayrollOrganization(input?: {
  actorUserId?: string | null;
}): Promise<{ id: string; defaultCurrency: string }> {
  if (input?.actorUserId) {
    const user = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: {
        organization: { select: { id: true, defaultCurrency: true } },
      },
    });

    if (user?.organization) {
      return user.organization;
    }
  }

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, defaultCurrency: true },
  });

  if (!organization) {
    throw new Error("No organization is configured.");
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
