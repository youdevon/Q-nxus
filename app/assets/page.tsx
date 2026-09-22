import Link from "next/link";
import type { Metadata } from "next";
import { Package, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageHeader } from "@/src/components/layout/page-header";
import { AssetRegisterDirectory } from "@/src/modules/assets/components/asset-register-directory";
import { getAssetRegister } from "@/src/modules/assets/data/get-assets";
import { requireAssetsViewAccess } from "@/src/modules/assets/data/require-assets-access";
import {
  parseAssetStatus,
  parseAssetType,
} from "@/src/modules/assets/lib/asset-enums";

export const metadata: Metadata = {
  title: "Asset register",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  status?: string;
  assetType?: string;
  warranty?: string;
  page?: string;
}>;

function parseWarrantyFilter(value: string | undefined): {
  warrantyWithinDays: number | null;
  warrantyExpiredOnly: boolean;
} {
  if (value === "expired") {
    return { warrantyWithinDays: null, warrantyExpiredOnly: true };
  }
  if (value === "30" || value === "60" || value === "90") {
    return {
      warrantyWithinDays: Number(value),
      warrantyExpiredOnly: false,
    };
  }
  return { warrantyWithinDays: null, warrantyExpiredOnly: false };
}

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [capabilities, params] = await Promise.all([
    requireAssetsViewAccess(),
    searchParams,
  ]);
  const status = parseAssetStatus(params.status);
  const assetType = parseAssetType(params.assetType);
  const warranty = parseWarrantyFilter(params.warranty);
  const page = parsePage(params.page);

  const data = await getAssetRegister({
    query: params.query,
    status,
    assetType,
    warrantyWithinDays: warranty.warrantyWithinDays,
    warrantyExpiredOnly: warranty.warrantyExpiredOnly,
    page,
  });

  const exportQuery = new URLSearchParams();
  if (params.query) exportQuery.set("query", params.query);
  if (params.status) exportQuery.set("status", params.status);
  if (params.assetType) exportQuery.set("assetType", params.assetType);
  if (params.warranty) exportQuery.set("warranty", params.warranty);
  const exportHref = `/assets/export${exportQuery.toString() ? `?${exportQuery}` : ""}`;

  return (
    <PageShell>
      <PageHeader
        title="Asset register"
        description="Track company hardware and property, who holds it, and warranty dates."
        icon={Package}
        actions={
          capabilities.can("assets.manage") ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/assets/receive" />}
              >
                Bulk receive
              </Button>
              <Button nativeButton={false} render={<Link href="/assets/new" />}>
                <Plus />
                New asset
              </Button>
            </div>
          ) : null
        }
      />

      <AssetRegisterDirectory
        data={data}
        filters={{
          query: params.query,
          status: status ?? undefined,
          assetType: assetType ?? undefined,
          warranty: params.warranty,
          page: params.page,
        }}
        exportHref={exportHref}
      />
    </PageShell>
  );
}
