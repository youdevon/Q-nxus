/** Normalize login identity the same way auth login does. */
export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Login identity for a provisioned employee account.
 * Personal email is required — never invent a work or @q-nxus.local address.
 */
export function buildEmployeeUserEmail(employee: {
  personalEmail: string | null;
}): string {
  const email = employee.personalEmail?.trim();

  if (!email) {
    throw new Error(
      "A personal email is required to create the employee login account.",
    );
  }

  return normalizeLoginEmail(email);
}
