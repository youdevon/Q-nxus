/**
 * Seeded platform administrator from prisma/seed.ts — must never be deleted or
 * disabled through admin reset / access management flows.
 */
export const DEFAULT_ADMINISTRATOR_EMAIL = "admin@q-nxus.local";

/** Stable id assigned in prisma/seed.ts for the default administrator. */
export const DEFAULT_ADMINISTRATOR_USER_ID = "user-devon-admin";

export const DEFAULT_ADMINISTRATOR_PROTECTION_MESSAGE =
  "The default system administrator account (admin@q-nxus.local) cannot be removed or disabled.";

type UserIdentity = {
  id?: string | null;
  email?: string | null;
};

export function isDefaultAdministratorUser(user: UserIdentity): boolean {
  if (user.id === DEFAULT_ADMINISTRATOR_USER_ID) {
    return true;
  }

  const email = user.email?.trim().toLowerCase();

  return email === DEFAULT_ADMINISTRATOR_EMAIL;
}

export function mergeProtectedUserIds(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}
