import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LocationForm } from "@/src/modules/admin/components/location-form"
import {
  getLocation,
  getLocationTypes,
} from "@/src/modules/admin/data/get-locations"

export const metadata: Metadata = {
  title: "Edit location",
}

export const dynamic = "force-dynamic"

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [location, locationTypes] = await Promise.all([
    getLocation(id),
    getLocationTypes(),
  ])

  if (!location) {
    notFound()
  }

  return (
    <LocationForm
      location={location}
      locationTypes={locationTypes}
    />
  )
}
