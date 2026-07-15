import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { OrganizationForm } from "@/src/modules/admin/components/organization-form"
import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile"

export const metadata: Metadata = {
  title: "Edit Organization",
}

export const dynamic = "force-dynamic"

export default async function OrganizationPage() {
  const organization = await getOrganizationProfile()

  if (!organization) {
    notFound()
  }

  const updatedAtLabel = new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: organization.defaultTimeZone,
  }).format(organization.updatedAt)

  return (
    <OrganizationForm
      organization={organization}
      updatedAtLabel={updatedAtLabel}
    />
  )
}
