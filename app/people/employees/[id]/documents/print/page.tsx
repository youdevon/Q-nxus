import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmployeeFilePrintView } from "@/src/modules/hr/components/employee-file-print-view";
import { getEmployeeFilePrintPack } from "@/src/modules/hr/data/get-employee-file-print-pack";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Print employee file",
};

export const dynamic = "force-dynamic";

export default async function EmployeeFilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePeopleManageAccess();
  const { id } = await params;
  const pack = await getEmployeeFilePrintPack(id);

  if (!pack) {
    notFound();
  }

  return <EmployeeFilePrintView pack={pack} />;
}
