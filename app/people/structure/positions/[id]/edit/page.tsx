import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PositionRecordForm } from "@/src/modules/hr/components/structure-record-form"
import {
  getPeopleStructure,
  getPositionProfile,
} from "@/src/modules/hr/data/get-people-structure"

export const metadata: Metadata = {
  title: "Edit Position",
}

export const dynamic = "force-dynamic"

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params

  const [position, departments] = await Promise.all([
    getPositionProfile(id),
    getPeopleStructure(),
  ])

  if (!position) {
    notFound()
  }

  return (
    <PositionRecordForm
      position={position}
      departments={departments}
    />
  )
}
