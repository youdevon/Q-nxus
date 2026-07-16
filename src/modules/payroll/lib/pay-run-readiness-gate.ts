/**
 * Readiness gate for including/posting employees on a pay run.
 */

export type PayRunReadinessRow = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
};

export type PayRunReadinessLookup = {
  isReady: boolean;
  blockingIssues: string[];
};

export function formatBlockedEmployees(
  blocked: string[],
  preface: string,
): string {
  if (blocked.length === 0) {
    return "";
  }

  return `${preface}\n${blocked.slice(0, 8).join("\n")}${
    blocked.length > 8 ? `\n…and ${blocked.length - 8} more.` : ""
  }`;
}

export function findEmployeesBlockedFromPayRun(
  payslips: PayRunReadinessRow[],
  readinessById: Map<string, PayRunReadinessLookup>,
): string[] {
  const blocked: string[] = [];

  for (const slip of payslips) {
    const row = readinessById.get(slip.employeeId);

    if (!row?.isReady) {
      blocked.push(
        `${slip.employeeName} (${slip.employeeNumber}): ${
          row?.blockingIssues.join(" ") || "Not payroll-ready."
        }`,
      );
    }
  }

  return blocked;
}
