import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "Documents",
}

export default function DocumentsPage() {
  return (
    <ModulePlaceholder
      title="Documents"
      moduleName="HR"
      description="Policy packs, employee files, and retention controls will live in this workspace."
    />
  )
}
