import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "People",
}

export default function PeoplePage() {
  return (
    <ModulePlaceholder
      title="People"
      moduleName="HR"
      description="Employee records, org structure, and workforce profiles will live in this workspace."
    />
  )
}
