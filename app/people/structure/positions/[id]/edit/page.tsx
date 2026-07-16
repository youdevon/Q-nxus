import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PositionRecordForm } from "@/src/modules/hr/components/structure-record-form";
import {
  getPeopleStructure,
  getPositionProfile,
} from "@/src/modules/hr/data/get-people-structure";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Edit Position",
};

export const dynamic = "force-dynamic";

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id } = await params;

  const [position, departments] = await Promise.all([
    getPositionProfile(id),
    getPeopleStructure(),
  ]);

  if (!position) {
    notFound();
  }

  return <PositionRecordForm position={position} departments={departments} />;
}
