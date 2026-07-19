import type { LifecycleTaskCode } from "@/generated/prisma/client";

export type LifecycleTaskAction = {
  label: string;
  href: string;
};

/**
 * Primary navigation action for an open lifecycle task.
 * Mark-done remains available for confirmation after the work is finished.
 */
export function resolveOnboardingTaskAction(
  code: LifecycleTaskCode | string,
  employeeId: string,
  context?: {
    activatableContractId?: string | null;
    currentContractId?: string | null;
  },
): LifecycleTaskAction | null {
  switch (code) {
    case "CREATE_DRAFT_CONTRACT":
      return {
        label: "Create draft contract",
        href: `/people/employees/${employeeId}/contracts/new`,
      };
    case "SEED_FILE_CHECKLIST":
    case "COMPLETE_REQUIRED_DOCS":
      return {
        label: "Open employee file",
        href: `/people/employees/${employeeId}/documents`,
      };
    case "ISSUE_ASSUMPTION_OF_DUTY":
      return {
        label: "New letter",
        href: `/people/employees/${employeeId}/documents/new`,
      };
    case "ACTIVATE_CONTRACT":
      if (context?.activatableContractId) {
        return {
          label: "Open contract to activate",
          href: `/people/employees/${employeeId}/contracts/${context.activatableContractId}`,
        };
      }
      return {
        label: "View contracts",
        href: `/people/employees/${employeeId}/contracts`,
      };
    case "PAYROLL_READINESS":
      return {
        label: "Payroll setup",
        href: `/payroll/employees/${employeeId}`,
      };
    default:
      return null;
  }
}

export function resolveOffboardingTaskAction(
  code: LifecycleTaskCode | string,
  employeeId: string,
  context?: {
    currentContractId?: string | null;
  },
): LifecycleTaskAction | null {
  switch (code) {
    case "CLOSE_CONTRACT":
      if (context?.currentContractId) {
        return {
          label: "Close contract",
          href: `/people/employees/${employeeId}/contracts/${context.currentContractId}/close`,
        };
      }
      return {
        label: "View contracts",
        href: `/people/employees/${employeeId}/contracts`,
      };
    case "FREEZE_EMPLOYEE_FILE":
      return {
        label: "Review employee file",
        href: `/people/employees/${employeeId}/documents`,
      };
    case "FINAL_PAY_CHECK":
      return {
        label: "Payroll setup",
        href: `/payroll/employees/${employeeId}`,
      };
    case "REVOKE_ACCESS":
      return {
        label: "Manage access",
        href: `/administration/access/users`,
      };
    default:
      return null;
  }
}
