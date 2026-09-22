import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getAssetForEdit,
  getAssetLocations,
} from "@/src/modules/assets/data/get-assets";
import { requireAssetsManageAccess } from "@/src/modules/assets/data/require-assets-access";
import { AssetForm } from "@/src/modules/assets/components/asset-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await getAssetForEdit(id);
  return {
    title: asset ? `Edit ${asset.assetNumber}` : "Edit asset",
  };
}

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAssetsManageAccess();
  const { id } = await params;
  const [asset, locations] = await Promise.all([
    getAssetForEdit(id),
    getAssetLocations(),
  ]);

  if (!asset) {
    notFound();
  }

  return <AssetForm asset={asset} locations={locations} />;
}
