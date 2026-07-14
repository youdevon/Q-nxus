import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "Administration",
}

export default function AdministrationPage() {
  return (
    <ModulePlaceholder
      title="Administration"
      moduleName="Administration"
      description="Tenant configuration, roles, and platform controls will live in this workspace."
    />
  )
}
