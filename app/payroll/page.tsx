import type { Metadata } from "next"

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder"

export const metadata: Metadata = {
  title: "Payroll",
}

export default function PayrollPage() {
  return (
    <ModulePlaceholder
      title="Payroll"
      moduleName="Payroll"
      description="Pay cycles, earnings, deductions, and disbursement workflows will live in this workspace."
    />
  )
}
