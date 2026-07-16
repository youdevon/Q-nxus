import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { OrganizationChart } from "@/src/modules/hr/components/organization-chart"
import { getOrganizationChart } from "@/src/modules/hr/data/get-organization-chart"

export const metadata: Metadata = {
  title: "Organization Chart",
}

export const dynamic = "force-dynamic"

export default async function OrganizationChartPage() {
  const data = await getOrganizationChart()

  if (!data) {
    notFound()
  }

  return <OrganizationChart data={data} />
}
