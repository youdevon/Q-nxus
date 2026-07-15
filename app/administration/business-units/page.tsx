import type { Metadata } from "next"

import { BusinessUnitsDirectory } from "@/src/modules/admin/components/business-units-directory"
import { getBusinessUnits } from "@/src/modules/admin/data/get-business-units"

export const metadata: Metadata = {
  title: "Business Units",
}

export const dynamic = "force-dynamic"

export default async function BusinessUnitsPage() {
  const businessUnits = await getBusinessUnits()

  return <BusinessUnitsDirectory businessUnits={businessUnits} />
}
