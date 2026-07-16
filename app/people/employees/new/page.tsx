import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmployeeForm } from "@/src/modules/hr/components/employee-form";
import { getEmployeeFormOptions } from "@/src/modules/hr/data/get-employee-form-data";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Employee",
};

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requirePeopleManageAccess();

  const departments = await getEmployeeFormOptions();

  if (departments.length === 0) {
    redirect("/people/structure");
  }

  return <EmployeeForm departments={departments} />;
}
