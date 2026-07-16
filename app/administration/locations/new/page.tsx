import type { Metadata } from "next";

import { LocationForm } from "@/src/modules/admin/components/location-form";
import { getLocationTypes } from "@/src/modules/admin/data/get-locations";

export const metadata: Metadata = {
  title: "New location",
};

export const dynamic = "force-dynamic";

export default async function NewLocationPage() {
  const locationTypes = await getLocationTypes();

  return <LocationForm locationTypes={locationTypes} />;
}
