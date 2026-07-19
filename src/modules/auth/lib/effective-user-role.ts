import type { Prisma } from "@/generated/prisma/client";
import { RoleAssignmentStatus } from "@/generated/prisma/client";

/**
 * Prisma `where` fragment for UserRole rows that currently grant access:
 * ACTIVE status and inside the effective window.
 */
export function effectiveUserRoleWhere(
  now: Date = new Date(),
): Prisma.UserRoleWhereInput {
  return {
    status: RoleAssignmentStatus.ACTIVE,
    effectiveFrom: { lte: now },
    OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
  };
}

/**
 * Pure check used by unit tests and any in-memory filtering.
 */
export function isUserRoleCurrentlyEffective(
  assignment: {
    status: string;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (assignment.status !== RoleAssignmentStatus.ACTIVE) {
    return false;
  }

  if (assignment.effectiveFrom.getTime() > now.getTime()) {
    return false;
  }

  if (
    assignment.effectiveUntil != null &&
    assignment.effectiveUntil.getTime() < now.getTime()
  ) {
    return false;
  }

  return true;
}
