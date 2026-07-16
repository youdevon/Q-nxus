import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PositionReportingForm } from "@/src/modules/hr/components/position-reporting-form"
import { getPositionReportingEditorData } from "@/src/modules/hr/data/get-organization-chart"

export const metadata: Metadata = {
  title: "Edit Position Reporting",
}

export const dynamic = "force-dynamic"

export default async function PositionReportingPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params

  const data =
    await getPositionReportingEditorData(id)

  if (!data) {
    notFound()
  }

  return <PositionReportingForm data={data} />
}
