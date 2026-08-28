import { revalidatePath } from "next/cache";

/**
 * Paths that read the current employment contract (salary, seat, readiness)
 * and must refresh after Activate / Save & activate.
 */
export function pathsAfterContractActivate(
  employeeId: string,
  contractId: string,
): string[] {
  return [
    "/people",
    `/people/employees/${employeeId}`,
    `/people/employees/${employeeId}/contracts`,
    `/people/employees/${employeeId}/contracts/${contractId}`,
    `/people/employees/${employeeId}/assignments`,
    `/people/employees/${employeeId}/documents`,
    "/people/leave/balances",
    "/people/leave",
    "/contracts",
    "/me",
    "/me/contracts",
    // Payroll surfaces that read EmploymentContract where isCurrent + ACTIVE
    "/payroll",
    "/payroll/salaries",
    `/payroll/employees/${employeeId}`,
    `/payroll/employees/${employeeId}/payslip`,
    "/payroll/runs",
  ];
}

export function revalidatePathsAfterContractActivate(
  employeeId: string,
  contractId: string,
): void {
  for (const path of pathsAfterContractActivate(employeeId, contractId)) {
    revalidatePath(path);
  }
}
