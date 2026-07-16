import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDescriptionForm } from "@/src/modules/hr/components/job-description-form";
import { getJobDescriptionById } from "@/src/modules/hr/data/get-job-descriptions";
import { requirePeopleDirectoryAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Job Description",
};

export const dynamic = "force-dynamic";

export default async function JobDescriptionPage({
  params,
}: {
  params: Promise<{
    id: string;
    jobDescriptionId: string;
  }>;
}) {
  await requirePeopleDirectoryAccess();

  const { id, jobDescriptionId } = await params;

  const data = await getJobDescriptionById(id, jobDescriptionId);

  if (!data) {
    notFound();
  }

  return (
    <JobDescriptionForm
      position={data.position}
      jobDescription={data.jobDescription}
    />
  );
}
