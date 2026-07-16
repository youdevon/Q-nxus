import type { Metadata } from "next"

import { AllowanceCategoryForm } from "@/src/modules/admin/components/allowance-category-form"

export const metadata: Metadata = {
  title: "New Allowance Category",
}

export default function NewAllowanceCategoryPage() {
  return <AllowanceCategoryForm />
}
