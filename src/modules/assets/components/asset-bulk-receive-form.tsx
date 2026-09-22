"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import type { AssetFormState } from "@/src/modules/assets/actions/manage-asset";
import { bulkReceiveAssets } from "@/src/modules/assets/actions/pair-and-bulk";
import type { AssetLocationOption } from "@/src/modules/assets/data/get-assets";
import {
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_TYPES,
  labelAssetEnum,
} from "@/src/modules/assets/lib/asset-enums";

const initialState: AssetFormState = {
  status: "idle",
  message: "",
};

function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AssetBulkReceiveForm({
  locations,
}: {
  locations: AssetLocationOption[];
}) {
  const [state, formAction, pending] = useActionState(
    bulkReceiveAssets,
    initialState,
  );
  const [pairAccessories, setPairAccessories] = useState(false);
  const today = todayInputValue();

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
      <PageHeader
        title="Bulk receive"
        description="Add multiple items to inventory as Available. Optionally create paired accessories (for example monitors under desktops) in the same batch."
        backHref="/assets"
        backLabel="Assets"
        actions={
          <FormPageActions cancelHref="/assets">
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Receiving…" : "Receive into inventory"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase md:col-span-2">
          Primary items
        </h2>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category"
            required
            defaultValue="COMPUTER_EQUIPMENT"
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
            defaultValue="DESKTOP"
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
          <span className="font-medium">Brand</span>
          <Input name="manufacturer" placeholder="e.g. Dell" />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Model</span>
          <Input name="modelName" placeholder="e.g. OptiPlex 7090" />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Condition</span>
          <select
            name="condition"
            defaultValue="NEW"
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
          <span className="font-medium">Storage location</span>
          <select
            name="locationId"
            defaultValue=""
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

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Purchase date</span>
          <Input type="date" name="purchaseDate" defaultValue={today} />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Received date</span>
          <Input type="date" name="receivedDate" defaultValue={today} />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Warranty ends</span>
          <Input type="date" name="warrantyEndsOn" />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">PO / reference</span>
          <Input name="purchaseReference" placeholder="Optional" />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Cost mode</span>
          <select
            name="costMode"
            defaultValue="each"
            className="h-9 rounded-md border border-input bg-transparent px-3"
          >
            <option value="each">Amount is per unit</option>
            <option value="total">Amount is total for the batch</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Purchase cost</span>
          <Input
            name="purchaseCost"
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Currency</span>
          <Input name="currencyCode" defaultValue="TTD" maxLength={3} />
        </label>

        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">Serial numbers</span>
          <Textarea
            name="serialNumbers"
            required
            rows={8}
            placeholder={"One serial per line\nABC123\nABC124\n…"}
          />
          <span className="text-xs text-muted-foreground">
            Up to 100 lines. Each becomes its own Available asset.
          </span>
        </label>

        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <Textarea name="notes" rows={2} />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={pairAccessories}
              onChange={(event) => setPairAccessories(event.target.checked)}
            />
            Also receive paired accessories (same count, paired 1:1 in order)
          </label>
          <input
            type="hidden"
            name="pairAccessories"
            value={pairAccessories ? "1" : "0"}
          />
        </div>

        {pairAccessories ? (
          <>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Accessory category</span>
              <select
                name="accessoryCategory"
                defaultValue="COMPUTER_EQUIPMENT"
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
              <span className="font-medium">Accessory type</span>
              <select
                name="accessoryType"
                defaultValue="MONITOR"
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
              <span className="font-medium">Accessory brand</span>
              <Input
                name="accessoryManufacturer"
                placeholder="Defaults to primary brand"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Accessory model</span>
              <Input
                name="accessoryModelName"
                placeholder="Defaults to primary model"
              />
            </label>

            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Accessory serial numbers</span>
              <Textarea
                name="accessorySerialNumbers"
                required={pairAccessories}
                rows={8}
                placeholder="Same number of lines as primary serials, matching order"
              />
            </label>
          </>
        ) : null}
      </section>
    </form>
  );
}
