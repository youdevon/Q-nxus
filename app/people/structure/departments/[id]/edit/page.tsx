import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DepartmentRecordForm } from "@/src/modules/hr/components/structure-record-form"
import { getDepartmentProfile } from "@/src/modules/hr/data/get-people-structure"

export const metadata: Metadata = {
  title: "Edit Department",
}

export const dynamic = "force-dynamic"

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const department = await getDepartmentProfile(id)

  if (!department) {
    notFound()
  }

  return <DepartmentRecordForm department={department} />
}
