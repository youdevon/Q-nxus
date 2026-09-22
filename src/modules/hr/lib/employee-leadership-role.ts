/**
 * Leadership band for employee header coloring.
 * Prefer position-title keywords; fall back to reporting hierarchy.
 */

export type EmployeeLeadershipRole =
  | "GENERAL_MANAGER"
  | "MANAGER"
  | "SUPERVISOR"
  | "WORKER";

export type EmployeeLeadershipRoleInput = {
  positionTitle: string | null | undefined;
  reportsToPositionId: string | null | undefined;
  directReportCount: number;
};

export function employeeLeadershipRoleLabel(
  role: EmployeeLeadershipRole,
): string {
  switch (role) {
    case "GENERAL_MANAGER":
      return "General manager";
    case "MANAGER":
      return "Manager";
    case "SUPERVISOR":
      return "Supervisor";
    case "WORKER":
      return "Regular worker";
  }
}

/** Header badge text — prefer job title over generic role labels. */
export function employeeHeaderBadgeLabel(
  role: EmployeeLeadershipRole,
  positionTitle: string | null | undefined,
): string {
  const title = positionTitle?.trim();
  if (title) {
    return title;
  }

  if (role === "WORKER") {
    return "No position";
  }

  return employeeLeadershipRoleLabel(role);
}

/**
 * Full header-band wash by leadership role — medium tint that fades out to the
 * right for depth without boxing the title. Applied on the page-header shell.
 */
export function employeeLeadershipAccentClass(
  role: EmployeeLeadershipRole,
): string {
  const band =
    "rounded-xl border px-4 py-3 sm:px-5 bg-gradient-to-r to-transparent";

  switch (role) {
    case "GENERAL_MANAGER":
      return `${band} border-amber-500/25 from-amber-500/35 via-amber-500/14 dark:from-amber-400/30 dark:via-amber-400/12`;
    case "MANAGER":
      return `${band} border-primary/25 from-primary/35 via-primary/14 dark:from-primary/30 dark:via-primary/12`;
    case "SUPERVISOR":
      return `${band} border-sky-500/25 from-sky-500/35 via-sky-500/14 dark:from-sky-400/30 dark:via-sky-400/12`;
    case "WORKER":
      return `${band} border-emerald-500/25 from-emerald-500/35 via-emerald-500/14 dark:from-emerald-400/30 dark:via-emerald-400/12`;
  }
}

export function employeeLeadershipBadgeClass(
  role: EmployeeLeadershipRole,
): string {
  switch (role) {
    case "GENERAL_MANAGER":
      return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "MANAGER":
      return "border-primary/30 bg-primary/10 text-primary";
    case "SUPERVISOR":
      return "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "WORKER":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  }
}

export function resolveEmployeeLeadershipRole(
  input: EmployeeLeadershipRoleInput,
): EmployeeLeadershipRole {
  const title = (input.positionTitle ?? "").trim().toLowerCase();
  const directReports = Math.max(0, input.directReportCount);

  if (
    /general\s*manager|\bg\.?\s*m\.?\b|chief executive|\bceo\b|managing director/.test(
      title,
    )
  ) {
    return "GENERAL_MANAGER";
  }

  if (/\bmanager\b/.test(title)) {
    return "MANAGER";
  }

  if (/\bsupervisor\b|\bteam\s*lead(er)?\b/.test(title)) {
    return "SUPERVISOR";
  }

  if (!input.reportsToPositionId && directReports > 0) {
    return "GENERAL_MANAGER";
  }

  if (directReports >= 3) {
    return "MANAGER";
  }

  if (directReports > 0) {
    return "SUPERVISOR";
  }

  return "WORKER";
}
