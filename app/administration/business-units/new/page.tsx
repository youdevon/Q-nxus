import type { Metadata } from "next"

import { BusinessUnitForm } from "@/src/modules/admin/components/business-unit-form"
import { getBusinessUnitOptions } from "@/src/modules/admin/data/get-business-units"

export const metadata: Metadata = {
  title: "New Business Unit",
}

export const dynamic = "force-dynamic"

export default async function NewBusinessUnitPage() {
  const parentOptions = await getBusinessUnitOptions()

  return <BusinessUnitForm parentOptions={parentOptions} />
}
