import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { JobDescriptionLifecycle } from "@/src/modules/hr/components/job-description-lifecycle"
import { getJobDescriptionLifecycle } from "@/src/modules/hr/data/get-job-descriptions"

export const metadata: Metadata = {
  title: "Job Description Versions",
}

export const dynamic = "force-dynamic"

export default async function JobDescriptionLifecyclePage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const data = await getJobDescriptionLifecycle(id)

  if (!data) {
    notFound()
  }

  return <JobDescriptionLifecycle data={data} />
}
