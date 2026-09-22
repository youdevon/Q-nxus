"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  createAsset,
  updateAsset,
  type AssetFormState,
} from "@/src/modules/assets/actions/manage-asset";
import type {
  AssetDetail,
  AssetLocationOption,
} from "@/src/modules/assets/data/get-assets";
import {
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  ASSET_TYPES,
  labelAssetEnum,
  type AssetTypeValue,
} from "@/src/modules/assets/lib/asset-enums";

const initialState: AssetFormState = {
  status: "idle",
  message: "",
};

export function AssetForm({
  asset,
  locations,
}: {
  asset?: AssetDetail | null;
  locations: AssetLocationOption[];
}) {
  const action = asset ? updateAsset : createAsset;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [assetType, setAssetType] = useState<AssetTypeValue>(
    asset?.assetType ?? "LAPTOP",
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      {asset ? <input type="hidden" name="id" value={asset.id} /> : null}

      <PageHeader
        title={asset ? `Edit ${asset.assetNumber}` : "New asset"}
        description="Register company hardware and property. Assign to an employee from the asset detail page."
        backHref={asset ? `/assets/${asset.id}` : "/assets"}
        backLabel={asset ? asset.assetNumber : "Assets"}
        actions={
          <FormPageActions
            cancelHref={asset ? `/assets/${asset.id}` : "/assets"}
          >
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : asset ? "Save asset" : "Create asset"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status === "error" ? (
        <div
          role="alert"
          className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category"
            required
            defaultValue={asset?.category ?? "COMPUTER_EQUIPMENT"}
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            {ASSET_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {labelAssetEnum(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Type</span>
          <select
            name="assetType"
            required
            value={assetType}
            onChange={(event) =>
              setAssetType(event.target.value as AssetTypeValue)
            }
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            {ASSET_TYPES.map((value) => (
              <option key={value} value={value}>
                {labelAssetEnum(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Status</span>
          <select
            name="status"
            required
            defaultValue={
              asset?.assignedEmployeeId || asset?.status === "ASSIGNED"
                ? "ASSIGNED"
                : (asset?.status ?? "AVAILABLE")
            }
            disabled={Boolean(
              asset?.assignedEmployeeId || asset?.status === "ASSIGNED",
            )}
            className="h-9 rounded-md border border-input bg-transparent px-3 disabled:opacity-70"
          >
            {ASSET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {labelAssetEnum(value)}
              </option>
            ))}
          </select>
          {asset?.assignedEmployeeId || asset?.status === "ASSIGNED" ? (
            <>
              <input type="hidden" name="status" value="ASSIGNED" />
              <span className="text-xs text-muted-foreground">
                Status stays Assigned while this asset is in custody. Use
                Return on the asset page to change it.
              </span>
            </>
          ) : null}
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Condition</span>
          <select
            name="condition"
            required
            defaultValue={asset?.condition ?? "GOOD"}
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            {ASSET_CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {labelAssetEnum(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Manufacturer / brand</span>
          <Input
            name="manufacturer"
            defaultValue={asset?.manufacturer ?? ""}
            placeholder="e.g. Dell"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Model</span>
          <Input
            name="modelName"
            defaultValue={asset?.modelName ?? ""}
            placeholder="e.g. Latitude 5540"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Asset tag</span>
          <Input
            name="assetTag"
            defaultValue={asset?.assetTag ?? ""}
            placeholder="Physical sticker / inventory tag"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Serial / service tag</span>
          <Input
            name="serialNumber"
            defaultValue={asset?.serialNumber ?? ""}
            placeholder="Unique device identifier"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Device name</span>
          <Input
            name="computerName"
            defaultValue={asset?.computerName ?? ""}
            placeholder="e.g. OFFICE-PRINTER-01"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Purchase date</span>
          <Input
            type="date"
            name="purchaseDate"
            defaultValue={asset?.purchaseDate ?? ""}
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Received date</span>
          <Input
            type="date"
            name="receivedDate"
            defaultValue={asset?.receivedDate ?? ""}
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Warranty ends</span>
          <Input
            type="date"
            name="warrantyEndsOn"
            defaultValue={asset?.warrantyEndsOn ?? ""}
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Purchase cost</span>
          <Input
            name="purchaseCost"
            inputMode="decimal"
            defaultValue={asset?.purchaseCost ?? ""}
            placeholder="0.00"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Currency</span>
          <Input
            name="currencyCode"
            defaultValue={asset?.currencyCode ?? "TTD"}
            maxLength={3}
          />
        </label>

        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">Storage location</span>
          <select
            name="locationId"
            defaultValue={asset?.locationId ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            <option value="">Not set</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">Description</span>
          <Textarea
            name="description"
            defaultValue={asset?.description ?? ""}
            rows={2}
          />
        </label>

        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <Textarea name="notes" defaultValue={asset?.notes ?? ""} rows={3} />
        </label>
      </section>
    </form>
  );
}
