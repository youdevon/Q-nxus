import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PositionAssignmentForm } from "@/src/modules/hr/components/position-assignment-form"
import { getPositionAssignmentFormData } from "@/src/modules/hr/data/get-employee-assignments"

export const metadata: Metadata = {
  title: "Assign Employee",
}

export const dynamic = "force-dynamic"

export default async function PositionAssignEmployeePage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const data = await getPositionAssignmentFormData(id)

  if (!data) {
    notFound()
  }

  return <PositionAssignmentForm data={data} />
}
