import type { UserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveStatutoryNumber } from "@/src/modules/hr/lib/employee-identity";

export type StatutoryNumberPair = {
  nisNumber: string | null;
  birNumber: string | null;
};

/**
 * Resolve how payroll may touch Employee NIS/BIR.
 *
 * Employee remains source of truth:
 * - Existing Employee values always win.
 * - Without `people.manage`, Employee is never updated and PayrollProfile only
 *   mirrors Employee (form values are not persisted as profile-only lasting data).
 * - With `people.manage`, empty Employee fields may be filled from the form
 *   (same gap-fill as resolveStatutoryNumber) and written back to Employee;
 *   PayrollProfile mirrors the resolved Employee values for readiness/snapshots.
 */
export function resolveEmployeeStatutoryWriteFromPayroll(input: {
  actor: Pick<UserCapabilities, "can">;
  employee: StatutoryNumberPair;
  form: StatutoryNumberPair;
}): {
  /** Values to store on PayrollProfile (mirror of Employee / resolved Employee). */
  profile: StatutoryNumberPair;
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
      profile: {
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
    profile: { nisNumber, birNumber },
    employeeUpdate: employeeChanged ? { nisNumber, birNumber } : null,
  };
}
