import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageHeader } from "@/src/components/layout/page-header";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import {
  AssetAssignForm,
  AssetReturnForm,
} from "@/src/modules/assets/components/asset-assign-return-forms";
import { AssetKitPanel } from "@/src/modules/assets/components/asset-kit-panel";
import { AssetMovementHistory } from "@/src/modules/assets/components/asset-movement-history";
import {
  getAssetAssignOptions,
  getAssetById,
  getPairableChildAssets,
} from "@/src/modules/assets/data/get-assets";
import { requireAssetsViewAccess } from "@/src/modules/assets/data/require-assets-access";
import { labelAssetEnum } from "@/src/modules/assets/lib/asset-enums";
import { employeeDisplayName } from "@/src/modules/assets/lib/employee-label";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await getAssetById(id);
  return {
    title: asset ? asset.assetNumber : "Asset",
  };
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const capabilities = await requireAssetsViewAccess();
  const { id } = await params;
  const canManage = capabilities.can("assets.manage");

  const [asset, options, pairableChildren] = await Promise.all([
    getAssetById(id),
    canManage ? getAssetAssignOptions() : Promise.resolve(null),
    canManage ? getPairableChildAssets(id) : Promise.resolve([]),
  ]);

  if (!asset) {
    notFound();
  }

  const isAssigned =
    Boolean(asset.assignedEmployeeId) || asset.status === "ASSIGNED";
  const isPairedChild = Boolean(asset.parentAssetId);
  const assigneeValue = asset.assignedEmployee
    ? `${employeeDisplayName(asset.assignedEmployee)} (#${asset.assignedEmployee.employeeNumber})`
    : isAssigned && asset.location
      ? `Office · ${asset.location.name} (${asset.location.code})`
      : null;

  return (
    <PageShell>
      <PageHeader
        title={asset.assetNumber}
        description={
          [asset.manufacturer, asset.modelName].filter(Boolean).join(" ") ||
          labelAssetEnum(asset.assetType)
        }
        icon={Package}
        backHref="/assets"
        backLabel="Assets"
        actions={
          canManage ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/assets/${asset.id}/edit`} />}
            >
              <Pencil />
              Edit
            </Button>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{labelAssetEnum(asset.status)}</Badge>
            <Badge variant="secondary">{labelAssetEnum(asset.assetType)}</Badge>
            <Badge variant="secondary">
              {labelAssetEnum(asset.condition)}
            </Badge>
            {asset.childAssets.length > 0 ? (
              <Badge variant="outline">
                +{asset.childAssets.length} paired
              </Badge>
            ) : null}
            {asset.parentAsset ? (
              <Badge variant="outline">Paired child</Badge>
            ) : null}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Category" value={labelAssetEnum(asset.category)} />
            <Detail label="Asset tag" value={asset.assetTag} />
            <Detail label="Brand" value={asset.manufacturer} />
            <Detail label="Model" value={asset.modelName} />
            <Detail label="Serial / service tag" value={asset.serialNumber} />
            <Detail label="Device name" value={asset.computerName} />
            <Detail
              label="Assignee"
              value={assigneeValue}
              href={
                asset.assignedEmployee
                  ? `/people/employees/${asset.assignedEmployee.id}/assets`
                  : undefined
              }
            />
            <Detail
              label="Location"
              value={
                asset.location
                  ? `${asset.location.name} (${asset.location.code})`
                  : null
              }
            />
            <Detail
              label="Purchase date"
              value={
                asset.purchaseDate
                  ? formatDisplayDate(asset.purchaseDate)
                  : null
              }
            />
            <Detail
              label="Received date"
              value={
                asset.receivedDate
                  ? formatDisplayDate(asset.receivedDate)
                  : null
              }
            />
            <Detail
              label="Warranty ends"
              value={
                asset.warrantyEndsOn
                  ? formatDisplayDate(asset.warrantyEndsOn)
                  : null
              }
            />
            <Detail
              label="Purchase cost"
              value={
                asset.purchaseCost
                  ? formatMoney(Number(asset.purchaseCost), {
                      currency: asset.currencyCode,
                    })
                  : null
              }
            />
            <Detail
              label="Description"
              value={asset.description}
              className="sm:col-span-2"
            />
            <Detail
              label="Notes"
              value={asset.notes}
              className="sm:col-span-2"
            />
          </dl>

          <AssetKitPanel
            assetId={asset.id}
            parentAsset={asset.parentAsset}
            childAssets={asset.childAssets}
            pairableChildren={pairableChildren}
            canManage={canManage}
          />

          <AssetMovementHistory
            assetId={asset.id}
            assignments={asset.assignments}
            canManage={canManage}
          />
        </section>

        {canManage && options ? (
          <aside className="flex flex-col gap-8 border-t border-border/70 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            {isPairedChild ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  Assignment
                </h3>
                <p className="text-xs text-muted-foreground">
                  This item is paired under{" "}
                  {asset.parentAsset ? (
                    <Link
                      href={`/assets/${asset.parentAsset.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {asset.parentAsset.assetNumber}
                    </Link>
                  ) : (
                    "a parent"
                  )}
                  . Assign or return from the parent so the kit moves together,
                  or unpair first.
                </p>
              </div>
            ) : (
              <>
                <AssetAssignForm
                  assetId={asset.id}
                  options={options}
                  currentEmployeeId={asset.assignedEmployeeId}
                  isAssigned={isAssigned}
                  pairedChildCount={asset.childAssets.length}
                />
                {isAssigned ? <AssetReturnForm assetId={asset.id} /> : null}
              </>
            )}
          </aside>
        ) : null}
      </div>
    </PageShell>
  );
}

function Detail({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm">
        {href && value ? (
          <Link href={href} className="underline-offset-2 hover:underline">
            {value}
          </Link>
        ) : (
          (value ?? "—")
        )}
      </dd>
    </div>
  );
}
