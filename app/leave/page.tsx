import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "Leave",
}

export default function LeavePage() {
  return (
    <ModulePlaceholder
      title="Leave"
      moduleName="HR"
      description="Leave balances, requests, and approvals will live in this workspace."
    />
  )
}
