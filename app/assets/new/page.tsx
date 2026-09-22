import type { Metadata } from "next";

import { getAssetLocations } from "@/src/modules/assets/data/get-assets";
import { requireAssetsManageAccess } from "@/src/modules/assets/data/require-assets-access";
import { AssetForm } from "@/src/modules/assets/components/asset-form";

export const metadata: Metadata = {
  title: "New asset",
};

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  await requireAssetsManageAccess();
  const locations = await getAssetLocations();

  return <AssetForm locations={locations} />;
}
