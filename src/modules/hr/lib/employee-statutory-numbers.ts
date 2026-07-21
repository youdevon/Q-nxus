import type { UserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveStatutoryNumber } from "@/src/modules/hr/lib/employee-identity";

export type StatutoryNumberPair = {
  nisNumber: string | null;
  birNumber: string | null;
};

/**
 * Resolve how payroll may touch Employee NIS/BIR.
 *
 * Employee is the sole store:
 * - Existing Employee values always win.
 * - Without `people.manage`, Employee is never updated (form values are ignored).
 * - With `people.manage`, empty Employee fields may be filled from the form
 *   and written back to Employee.
 */
export function resolveEmployeeStatutoryWriteFromPayroll(input: {
  actor: Pick<UserCapabilities, "can">;
  employee: StatutoryNumberPair;
  form: StatutoryNumberPair;
}): {
  /** Resolved NIS/BIR for readiness / payslip (Employee SoT after optional write). */
  resolved: StatutoryNumberPair;
  /** Patch for Employee — null means do not update Employee. */
  employeeUpdate: StatutoryNumberPair | null;
} {
  const canManagePeople = input.actor.can("people.manage");

  const employeeNis = input.employee.nisNumber?.trim() || null;
  const employeeBir = input.employee.birNumber?.trim() || null;
  const formNis = input.form.nisNumber?.trim() || null;
  const formBir = input.form.birNumber?.trim() || null;

  if (!canManagePeople) {
    return {
      resolved: {
        nisNumber: employeeNis,
        birNumber: employeeBir,
      },
      employeeUpdate: null,
    };
  }

  const nisNumber = resolveStatutoryNumber(employeeNis, formNis);
  const birNumber = resolveStatutoryNumber(employeeBir, formBir);

  const employeeChanged =
    nisNumber !== employeeNis || birNumber !== employeeBir;

  return {
    resolved: { nisNumber, birNumber },
    employeeUpdate: employeeChanged ? { nisNumber, birNumber } : null,
  };
}
