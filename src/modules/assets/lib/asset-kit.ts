import type { AssetCondition, Prisma } from "@/generated/prisma/client";

export type KitAssetSummary = {
  id: string;
  assetNumber: string;
  assetType: string;
  manufacturer: string | null;
  modelName: string | null;
  serialNumber: string | null;
  status: string;
  condition: AssetCondition;
  parentAssetId: string | null;
  locationId: string | null;
};

/**
 * Direct children only (one-level kits). Used when moving a parent’s custody.
 */
export async function listChildAssets(
  tx: Prisma.TransactionClient,
  parentAssetId: string,
  organizationId: string,
): Promise<KitAssetSummary[]> {
  return tx.asset.findMany({
    where: {
      parentAssetId,
      organizationId,
      archivedAt: null,
    },
    select: {
      id: true,
      assetNumber: true,
      assetType: true,
      manufacturer: true,
      modelName: true,
      serialNumber: true,
      status: true,
      condition: true,
      parentAssetId: true,
      locationId: true,
    },
    orderBy: { assetNumber: "asc" },
  });
}

export function kitLabel(asset: {
  assetNumber: string;
  manufacturer: string | null;
  modelName: string | null;
  assetType: string;
}): string {
  const model = [asset.manufacturer, asset.modelName].filter(Boolean).join(" ");
  return model ? `${asset.assetNumber} · ${model}` : asset.assetNumber;
}
