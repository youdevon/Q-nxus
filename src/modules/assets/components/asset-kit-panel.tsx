"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  pairAsset,
  unpairAsset,
} from "@/src/modules/assets/actions/pair-and-bulk";
import type { AssetFormState } from "@/src/modules/assets/actions/manage-asset";
import type {
  AssetKitMember,
  AssetPairOption,
} from "@/src/modules/assets/data/get-assets";
import { labelAssetEnum } from "@/src/modules/assets/lib/asset-enums";
import { kitLabel } from "@/src/modules/assets/lib/asset-kit";

const initialState: AssetFormState = {
  status: "idle",
  message: "",
};

function KitMemberLine({ member }: { member: AssetKitMember }) {
  const model = [member.manufacturer, member.modelName]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
      <div>
        <Link
          href={`/assets/${member.id}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {member.assetNumber}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {labelAssetEnum(member.assetType)}
          {model ? ` · ${model}` : ""}
          {member.serialNumber ? ` · ${member.serialNumber}` : ""}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {labelAssetEnum(member.status)}
      </span>
    </div>
  );
}

export function AssetKitPanel({
  assetId,
  parentAsset,
  childAssets,
  pairableChildren,
  canManage,
}: {
  assetId: string;
  parentAsset: AssetKitMember | null;
  childAssets: AssetKitMember[];
  pairableChildren: AssetPairOption[];
  canManage: boolean;
}) {
  const [pairOpen, setPairOpen] = useState(false);
  const [pairState, pairAction, pairPending] = useActionState(
    pairAsset,
    initialState,
  );
  const [unpairState, unpairAction, unpairPending] = useActionState(
    unpairAsset,
    initialState,
  );

  useEffect(() => {
    if (pairState.status === "error") toast.error(pairState.message);
  }, [pairState]);

  useEffect(() => {
    if (unpairState.status === "error") toast.error(unpairState.message);
  }, [unpairState]);

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold tracking-wide uppercase">
        Paired equipment
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Parent–child kits (for example a desktop with its monitor). Assigning
        or returning the parent moves paired children with it.
      </p>

      {parentAsset ? (
        <div className="mb-4 rounded-md border border-border/70 px-3 py-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Parent
          </p>
          <Link
            href={`/assets/${parentAsset.id}`}
            className="text-sm font-medium underline-offset-2 hover:underline"
          >
            {kitLabel(parentAsset)}
          </Link>
          <p className="text-xs text-muted-foreground">
            {labelAssetEnum(parentAsset.assetType)}
            {parentAsset.serialNumber
              ? ` · ${parentAsset.serialNumber}`
              : ""}
          </p>
          {canManage ? (
            <form action={unpairAction} className="mt-2">
              <input type="hidden" name="childAssetId" value={assetId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={unpairPending}
              >
                {unpairPending ? "Unpairing…" : "Unpair from parent"}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {childAssets.length > 0 ? (
        <ul className="mb-3 divide-y divide-border/60 border-y border-border/60">
          {childAssets.map((child) => (
            <li key={child.id} className="flex items-start justify-between gap-3">
              <KitMemberLine member={child} />
              {canManage ? (
                <form action={unpairAction} className="shrink-0 py-2">
                  <input type="hidden" name="childAssetId" value={child.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={unpairPending}
                  >
                    Unpair
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !parentAsset ? (
        <p className="mb-3 text-sm text-muted-foreground">
          No paired accessories yet.
        </p>
      ) : null}

      {canManage && !parentAsset ? (
        pairOpen ? (
          <form action={pairAction} className="grid gap-3">
            <input type="hidden" name="parentAssetId" value={assetId} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Pair accessory under this asset</span>
              <select
                name="childAssetId"
                required
                defaultValue=""
                className="h-9 rounded-md border border-input bg-transparent px-3"
              >
                <option value="" disabled>
                  Select unpaired asset…
                </option>
                {pairableChildren.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.assetNumber}
                    {" · "}
                    {labelAssetEnum(option.assetType)}
                    {option.serialNumber ? ` · ${option.serialNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {pairableChildren.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No unpaired accessories available. Receive or create them
                first.
              </p>
            ) : null}
            {pairState.status === "error" ? (
              <p className="text-sm text-destructive">{pairState.message}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pairPending || pairableChildren.length === 0}>
                {pairPending ? "Pairing…" : "Pair"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPairOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setPairOpen(true)}>
            Pair accessory
          </Button>
        )
      ) : null}
    </div>
  );
}
