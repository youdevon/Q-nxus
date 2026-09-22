import type { AssetEmployeeOption } from "@/src/modules/assets/data/get-assets";

export function employeeLabel(employee: AssetEmployeeOption): string {
  const name = [employee.preferredName ?? employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");
  return `${employee.employeeNumber} — ${name}`;
}

export function employeeDisplayName(employee: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return [employee.preferredName ?? employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");
}
