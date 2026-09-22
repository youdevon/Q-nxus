import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmployeeForm } from "@/src/modules/hr/components/employee-form";
import { getEmployeeFormOptions } from "@/src/modules/hr/data/get-employee-form-data";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { WORKFORCE_CATEGORY_OPTIONS } from "@/src/modules/hr/lib/workforce-category";

export const metadata: Metadata = {
  title: "New person",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  category?: string;
}>;

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePeopleManageAccess();

  const params = await searchParams;
  const initialWorkforceCategory = WORKFORCE_CATEGORY_OPTIONS.some(
    (option) => option.value === params.category,
  )
    ? params.category
    : undefined;

  const departments = await getEmployeeFormOptions();

  if (departments.length === 0) {
    redirect("/people/structure");
  }

  return (
    <EmployeeForm
      departments={departments}
      initialWorkforceCategory={initialWorkforceCategory}
    />
  );
}
