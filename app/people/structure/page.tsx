import type { Metadata } from "next"

import { PeopleStructureWorkspace } from "@/src/modules/hr/components/people-structure-workspace"
import { getPeopleStructure } from "@/src/modules/hr/data/get-people-structure"

export const metadata: Metadata = {
  title: "People Structure",
}

export const dynamic = "force-dynamic"

export default async function PeopleStructurePage() {
  const departments = await getPeopleStructure()

  return (
    <PeopleStructureWorkspace departments={departments} />
  )
}
