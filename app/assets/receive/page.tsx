import type { Metadata } from "next";

import { PageShell } from "@/src/components/layout/page-shell";
import { AssetBulkReceiveForm } from "@/src/modules/assets/components/asset-bulk-receive-form";
import { getAssetLocations } from "@/src/modules/assets/data/get-assets";
import { requireAssetsManageAccess } from "@/src/modules/assets/data/require-assets-access";

export const metadata: Metadata = {
  title: "Bulk receive assets",
};

export const dynamic = "force-dynamic";

export default async function AssetBulkReceivePage() {
  await requireAssetsManageAccess();
  const locations = await getAssetLocations();

  return (
    <PageShell>
      <AssetBulkReceiveForm locations={locations} />
    </PageShell>
  );
}
