import type { Metadata } from "next";

import { DepartmentRecordForm } from "@/src/modules/hr/components/structure-record-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Department",
};

export default async function NewDepartmentPage() {
  await requirePeopleManageAccess();

  return <DepartmentRecordForm />;
}
