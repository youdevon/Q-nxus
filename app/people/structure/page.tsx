import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PeopleStructureWorkspace } from "@/src/modules/hr/components/people-structure-workspace"
import { getPeopleStructure } from "@/src/modules/hr/data/get-people-structure"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

export const metadata: Metadata = {
  title: "People Structure",
}

export const dynamic = "force-dynamic"

export default async function PeopleStructurePage() {
  const capabilities = await getUserCapabilities()

  if (!capabilities?.can("people.manage")) {
    redirect("/people")
  }

  const departments = await getPeopleStructure()

  return (
    <PeopleStructureWorkspace departments={departments} />
  )
}
