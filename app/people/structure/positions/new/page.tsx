import type { Metadata } from "next"

import { PositionRecordForm } from "@/src/modules/hr/components/structure-record-form"
import { getPeopleStructure } from "@/src/modules/hr/data/get-people-structure"

export const metadata: Metadata = {
  title: "New Position",
}

export const dynamic = "force-dynamic"

export default async function NewPositionPage() {
  const departments = await getPeopleStructure()

  return (
    <PositionRecordForm departments={departments} />
  )
}
