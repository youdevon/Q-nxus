import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDescriptionForm } from "@/src/modules/hr/components/job-description-form";
import { getPositionJobDescriptions } from "@/src/modules/hr/data/get-job-descriptions";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Job Description",
};

export const dynamic = "force-dynamic";

export default async function NewJobDescriptionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id } = await params;
  const data = await getPositionJobDescriptions(id);

  if (!data) {
    notFound();
  }

  return <JobDescriptionForm position={data.position} />;
}
