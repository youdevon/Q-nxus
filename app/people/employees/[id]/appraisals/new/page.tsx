import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PerformanceAppraisalForm } from "@/src/modules/hr/components/performance-appraisal-form"
import { getAppraisalCreationData } from "@/src/modules/hr/data/get-performance-appraisals"

export const metadata: Metadata = {
  title: "New Performance Appraisal",
}

export const dynamic = "force-dynamic"

export default async function NewPerformanceAppraisalPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const data = await getAppraisalCreationData(id)

  if (!data) {
    notFound()
  }

  return <PerformanceAppraisalForm data={data} />
}
