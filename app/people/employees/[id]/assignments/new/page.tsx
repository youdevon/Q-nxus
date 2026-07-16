import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmployeeAssignmentForm } from "@/src/modules/hr/components/employee-assignment-form"
import { getAssignmentFormData } from "@/src/modules/hr/data/get-employee-assignments"

export const metadata: Metadata = {
  title: "Change Assignment",
}

export const dynamic = "force-dynamic"

export default async function NewEmployeeAssignmentPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const { history, departments } =
    await getAssignmentFormData(id)

  if (!history) {
    notFound()
  }

  return (
    <EmployeeAssignmentForm
      history={history}
      departments={departments}
    />
  )
}
