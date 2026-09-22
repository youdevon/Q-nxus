"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { formatSequenceReference } from "@/src/modules/admin/lib/numbering-sequence";
import { isFeatureEnabled } from "@/src/modules/admin/lib/feature-control";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getDefaultOrganizationId } from "@/src/modules/assets/data/get-assets";
import {
  parseAssetCategory,
  parseAssetCondition,
  parseAssetType,
  type AssetCategoryValue,
  type AssetConditionValue,
  type AssetTypeValue,
} from "@/src/modules/assets/lib/asset-enums";
import { kitLabel } from "@/src/modules/assets/lib/asset-kit";

import type { AssetFormState } from "@/src/modules/assets/actions/manage-asset";

const BULK_MAX = 100;

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function parseOptionalDecimal(value: string | null): Prisma.Decimal | null {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }
  return new Prisma.Decimal(value);
}

function parseSerialLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function revalidateAssetPaths(assetId?: string) {
  revalidatePath("/assets");
  revalidatePath("/assets/receive");
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/assets/${assetId}/edit`);
  }
}

async function allocateAssetNumber(
  organizationId: string,
  transaction: Prisma.TransactionClient,
): Promise<string> {
  const sequence = await transaction.numberingSequence.findFirst({
    where: { organizationId, sequenceCode: "ASSET", isActive: true },
  });

  if (!sequence) {
    throw new Error("ASSET_SEQUENCE_MISSING");
  }

  const updatedSequence = await transaction.numberingSequence.update({
    where: { id: sequence.id },
    data: {
      currentNumber: { increment: 1 },
      version: { increment: 1 },
    },
  });

  return formatSequenceReference({
    value: updatedSequence.currentNumber,
    minimumLength: updatedSequence.minimumLength,
    prefix: updatedSequence.prefix,
    suffix: updatedSequence.suffix,
  });
}

export async function pairAsset(
  _previousState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await isFeatureEnabled("assets"))) {
    return { status: "error", message: "Assets are not enabled." };
  }

  const actor = await requireActor("assets.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const parentAssetId = textValue(formData, "parentAssetId");
  const childAssetId = textValue(formData, "childAssetId");

  if (!parentAssetId || !childAssetId) {
    return {
      status: "error",
      message: "Select both a parent asset and a child to pair.",
    };
  }

  if (parentAssetId === childAssetId) {
    return { status: "error", message: "An asset cannot be paired with itself." };
  }

  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const [parent, child] = await Promise.all([
    prisma.asset.findFirst({
      where: { id: parentAssetId, organizationId, archivedAt: null },
      select: {
        id: true,
        assetNumber: true,
        parentAssetId: true,
        manufacturer: true,
        modelName: true,
        assetType: true,
      },
    }),
    prisma.asset.findFirst({
      where: { id: childAssetId, organizationId, archivedAt: null },
      select: {
        id: true,
        assetNumber: true,
        parentAssetId: true,
        manufacturer: true,
        modelName: true,
        assetType: true,
        _count: { select: { childAssets: true } },
      },
    }),
  ]);

  if (!parent || !child) {
    return { status: "error", message: "One of the assets was not found." };
  }

  if (parent.parentAssetId) {
    return {
      status: "error",
      message:
        "The parent is already paired under another asset. Unpair it first.",
    };
  }

  if (child.parentAssetId) {
    return {
      status: "error",
      message: "That accessory is already paired. Unpair it first.",
    };
  }

  if (child._count.childAssets > 0) {
    return {
      status: "error",
      message:
        "That asset already has paired children. Unpair them before making it a child.",
    };
  }

  const audit = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: child.id },
      data: { parentAssetId: parent.id },
    });

    await tx.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        organizationId,
        moduleKey: "assets",
        action: "ASSET_PAIRED",
        entityType: "Asset",
        entityId: child.id,
        description: `Paired ${kitLabel(child)} under ${kitLabel(parent)}.`,
        newValues: {
          parentAssetId: parent.id,
          childAssetId: child.id,
        },
        ...audit,
      },
    });
  });

  revalidateAssetPaths(parent.id);
  revalidateAssetPaths(child.id);
  redirect(`/assets/${parent.id}`);
}

export async function unpairAsset(
  _previousState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await isFeatureEnabled("assets"))) {
    return { status: "error", message: "Assets are not enabled." };
  }

  const actor = await requireActor("assets.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const childAssetId = textValue(formData, "childAssetId");
  if (!childAssetId) {
    return { status: "error", message: "Select an asset to unpair." };
  }

  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const child = await prisma.asset.findFirst({
    where: { id: childAssetId, organizationId, archivedAt: null },
    select: {
      id: true,
      assetNumber: true,
      parentAssetId: true,
      manufacturer: true,
      modelName: true,
      assetType: true,
    },
  });

  if (!child) {
    return { status: "error", message: "Asset not found." };
  }

  if (!child.parentAssetId) {
    return { status: "error", message: "This asset is not paired." };
  }

  const parentAssetId = child.parentAssetId;
  const audit = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: child.id },
      data: { parentAssetId: null },
    });

    await tx.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        organizationId,
        moduleKey: "assets",
        action: "ASSET_UNPAIRED",
        entityType: "Asset",
        entityId: child.id,
        description: `Unpaired ${kitLabel(child)} from its parent.`,
        oldValues: { parentAssetId },
        ...audit,
      },
    });
  });

  revalidateAssetPaths(parentAssetId);
  revalidateAssetPaths(child.id);
  redirect(`/assets/${child.id}`);
}

type BulkLineShared = {
  category: AssetCategoryValue;
  assetType: AssetTypeValue;
  condition: AssetConditionValue;
  manufacturer: string | null;
  modelName: string | null;
  purchaseDate: Date | null;
  receivedDate: Date | null;
  warrantyEndsOn: Date | null;
  locationId: string | null;
  currencyCode: string;
  notes: string | null;
  unitCost: Prisma.Decimal | null;
};

export async function bulkReceiveAssets(
  _previousState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await isFeatureEnabled("assets"))) {
    return { status: "error", message: "Assets are not enabled." };
  }

  const actor = await requireActor("assets.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const category = parseAssetCategory(textValue(formData, "category"));
  const assetType = parseAssetType(textValue(formData, "assetType"));
  const condition =
    parseAssetCondition(textValue(formData, "condition")) ?? "NEW";
  const manufacturer = nullableText(formData, "manufacturer");
  const modelName = nullableText(formData, "modelName");
  const locationId = nullableText(formData, "locationId");
  const currencyCode = nullableText(formData, "currencyCode") ?? "TTD";
  const purchaseReference = nullableText(formData, "purchaseReference");
  const notesBase = nullableText(formData, "notes");
  const notes = [purchaseReference ? `PO/Ref: ${purchaseReference}` : null, notesBase]
    .filter(Boolean)
    .join("\n") || null;

  const purchaseDate = parseOptionalDate(nullableText(formData, "purchaseDate"));
  const receivedDate = parseOptionalDate(nullableText(formData, "receivedDate"));
  const warrantyEndsOn = parseOptionalDate(
    nullableText(formData, "warrantyEndsOn"),
  );

  if (!category || !assetType) {
    return {
      status: "error",
      message: "Select a category and type for the primary items.",
    };
  }

  const primarySerials = parseSerialLines(textValue(formData, "serialNumbers"));
  if (primarySerials.length === 0) {
    return {
      status: "error",
      message: "Enter at least one serial number (one per line).",
    };
  }
  if (primarySerials.length > BULK_MAX) {
    return {
      status: "error",
      message: `You can receive at most ${BULK_MAX} items at once.`,
    };
  }

  const uniquePrimary = new Set(primarySerials.map((s) => s.toLowerCase()));
  if (uniquePrimary.size !== primarySerials.length) {
    return {
      status: "error",
      message: "Primary serial numbers must be unique within this batch.",
    };
  }

  const costMode = textValue(formData, "costMode") || "each";
  const purchaseCostRaw = nullableText(formData, "purchaseCost");
  const purchaseCost = parseOptionalDecimal(purchaseCostRaw);
  if (purchaseCostRaw && !purchaseCost) {
    return {
      status: "error",
      message: "Enter a valid purchase cost (e.g. 4500.00).",
    };
  }

  let unitCost: Prisma.Decimal | null = null;
  if (purchaseCost) {
    unitCost =
      costMode === "total"
        ? purchaseCost.div(primarySerials.length).toDecimalPlaces(2)
        : purchaseCost;
  }

  const pairAccessories = textValue(formData, "pairAccessories") === "1";
  const accessoryType = parseAssetType(textValue(formData, "accessoryType"));
  const accessoryCategory =
    parseAssetCategory(textValue(formData, "accessoryCategory")) ?? category;
  const accessoryManufacturer = nullableText(formData, "accessoryManufacturer");
  const accessoryModelName = nullableText(formData, "accessoryModelName");
  const accessorySerials = parseSerialLines(
    textValue(formData, "accessorySerialNumbers"),
  );

  if (pairAccessories) {
    if (!accessoryType) {
      return {
        status: "error",
        message: "Select a type for the paired accessories.",
      };
    }
    if (accessorySerials.length !== primarySerials.length) {
      return {
        status: "error",
        message: `Enter exactly ${primarySerials.length} accessory serials (one per primary item, same order).`,
      };
    }
    const uniqueAccessory = new Set(
      accessorySerials.map((s) => s.toLowerCase()),
    );
    if (uniqueAccessory.size !== accessorySerials.length) {
      return {
        status: "error",
        message: "Accessory serial numbers must be unique within this batch.",
      };
    }
    for (const serial of accessorySerials) {
      if (uniquePrimary.has(serial.toLowerCase())) {
        return {
          status: "error",
          message: `Serial ${serial} appears in both primary and accessory lists.`,
        };
      }
    }
  }

  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  if (locationId) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, organizationId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!location) {
      return { status: "error", message: "Storage location not found." };
    }
  }

  const allSerials = [
    ...primarySerials,
    ...(pairAccessories ? accessorySerials : []),
  ];
  const existing = await prisma.asset.findMany({
    where: {
      organizationId,
      archivedAt: null,
      serialNumber: { in: allSerials },
    },
    select: { serialNumber: true },
  });
  if (existing.length > 0) {
    return {
      status: "error",
      message: `These serials are already registered: ${existing
        .map((row) => row.serialNumber)
        .filter(Boolean)
        .join(", ")}`,
    };
  }

  const primaryShared: BulkLineShared = {
    category,
    assetType,
    condition,
    manufacturer,
    modelName,
    purchaseDate,
    receivedDate,
    warrantyEndsOn,
    locationId,
    currencyCode,
    notes,
    unitCost,
  };

  const accessoryShared: BulkLineShared | null = pairAccessories
    ? {
        category: accessoryCategory,
        assetType: accessoryType!,
        condition,
        manufacturer: accessoryManufacturer ?? manufacturer,
        modelName: accessoryModelName ?? modelName,
        purchaseDate,
        receivedDate,
        warrantyEndsOn,
        locationId,
        currencyCode,
        notes,
        unitCost: null,
      }
    : null;

  const audit = await getAuditRequestMetadata(formData);

  try {
    const createdIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];

      for (let index = 0; index < primarySerials.length; index += 1) {
        const primaryNumber = await allocateAssetNumber(organizationId, tx);
        const primary = await tx.asset.create({
          data: {
            organizationId,
            assetNumber: primaryNumber,
            category: primaryShared.category,
            assetType: primaryShared.assetType,
            condition: primaryShared.condition,
            status: "AVAILABLE",
            manufacturer: primaryShared.manufacturer,
            modelName: primaryShared.modelName,
            serialNumber: primarySerials[index],
            purchaseDate: primaryShared.purchaseDate,
            receivedDate: primaryShared.receivedDate,
            warrantyEndsOn: primaryShared.warrantyEndsOn,
            locationId: primaryShared.locationId,
            currencyCode: primaryShared.currencyCode,
            purchaseCost: primaryShared.unitCost,
            notes: primaryShared.notes,
            assignedEmployeeId: null,
            parentAssetId: null,
          },
        });
        ids.push(primary.id);

        await tx.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            organizationId,
            moduleKey: "assets",
            action: "ASSET_CREATED",
            entityType: "Asset",
            entityId: primary.id,
            description: `Bulk received ${primary.assetNumber}.`,
            newValues: {
              assetNumber: primary.assetNumber,
              serialNumber: primary.serialNumber,
              bulk: true,
            },
            ...audit,
          },
        });

        if (accessoryShared) {
          const accessoryNumber = await allocateAssetNumber(organizationId, tx);
          const accessory = await tx.asset.create({
            data: {
              organizationId,
              assetNumber: accessoryNumber,
              category: accessoryShared.category,
              assetType: accessoryShared.assetType,
              condition: accessoryShared.condition,
              status: "AVAILABLE",
              manufacturer: accessoryShared.manufacturer,
              modelName: accessoryShared.modelName,
              serialNumber: accessorySerials[index],
              purchaseDate: accessoryShared.purchaseDate,
              receivedDate: accessoryShared.receivedDate,
              warrantyEndsOn: accessoryShared.warrantyEndsOn,
              locationId: accessoryShared.locationId,
              currencyCode: accessoryShared.currencyCode,
              purchaseCost: null,
              notes: accessoryShared.notes,
              assignedEmployeeId: null,
              parentAssetId: primary.id,
            },
          });
          ids.push(accessory.id);

          await tx.auditEvent.create({
            data: {
              userId: actor.actor.userId,
              organizationId,
              moduleKey: "assets",
              action: "ASSET_CREATED",
              entityType: "Asset",
              entityId: accessory.id,
              description: `Bulk received ${accessory.assetNumber} paired under ${primary.assetNumber}.`,
              newValues: {
                assetNumber: accessory.assetNumber,
                serialNumber: accessory.serialNumber,
                parentAssetId: primary.id,
                bulk: true,
              },
              ...audit,
            },
          });
        }
      }

      return ids;
    });

    revalidatePath("/assets");
    revalidatePath("/assets/receive");
    redirect(
      createdIds[0] ? `/assets/${createdIds[0]}` : "/assets",
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message:
          "A serial number in this batch is already registered. Check the register.",
      };
    }
    if (error instanceof Error && error.message === "ASSET_SEQUENCE_MISSING") {
      return {
        status: "error",
        message:
          "The ASSET numbering sequence is not configured. Set it up under Administration → Numbering sequences.",
      };
    }
    throw error;
  }
}
