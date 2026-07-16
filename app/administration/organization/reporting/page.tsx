import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrganizationReportingLinesEditor } from "@/src/modules/admin/components/organization-reporting-lines-editor";
import { getOrganizationReportingLines } from "@/src/modules/admin/data/get-organization-reporting-lines";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Reporting Lines",
};

export const dynamic = "force-dynamic";

export default async function OrganizationReportingLinesPage() {
  await requirePeopleManageAccess();

  const data = await getOrganizationReportingLines();

  if (!data) {
    notFound();
  }

  return <OrganizationReportingLinesEditor data={data} />;
}
