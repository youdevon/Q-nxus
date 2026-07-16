import type { Metadata } from "next";

import { LocationsDirectory } from "@/src/modules/admin/components/locations-directory";
import { getLocations } from "@/src/modules/admin/data/get-locations";

export const metadata: Metadata = {
  title: "Locations",
};

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locations = await getLocations();

  return <LocationsDirectory locations={locations} />;
}
