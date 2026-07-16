import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PositionAssignmentForm } from "@/src/modules/hr/components/position-assignment-form";
import { getPositionAssignmentFormData } from "@/src/modules/hr/data/get-employee-assignments";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Assign Employee",
};

export const dynamic = "force-dynamic";

export default async function PositionAssignEmployeePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id } = await params;
  const data = await getPositionAssignmentFormData(id);

  if (!data) {
    notFound();
  }

  return <PositionAssignmentForm data={data} />;
}
