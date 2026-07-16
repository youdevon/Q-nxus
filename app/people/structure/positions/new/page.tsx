import type { Metadata } from "next";

import { PositionRecordForm } from "@/src/modules/hr/components/structure-record-form";
import { getPeopleStructure } from "@/src/modules/hr/data/get-people-structure";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Position",
};

export const dynamic = "force-dynamic";

export default async function NewPositionPage() {
  await requirePeopleManageAccess();

  const departments = await getPeopleStructure();

  return <PositionRecordForm departments={departments} />;
}
