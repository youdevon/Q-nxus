import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "Contracts",
}

export default function ContractsPage() {
  return (
    <ModulePlaceholder
      title="Contracts"
      moduleName="HR"
      description="Employment agreements, amendments, and renewals will live in this workspace."
    />
  )
}
