"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { formatSequenceReference } from "@/src/modules/admin/lib/numbering-sequence";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  parseAssetAssignmentType,
  parseAssetCategory,
  parseAssetCondition,
  parseAssetStatus,
  parseAssetType,
} from "@/src/modules/assets/lib/asset-enums";
import { isFeatureEnabled } from "@/src/modules/admin/lib/feature-control";

import { getDefaultOrganizationId, getAssetAssignEmployees } from "@/src/modules/assets/data/get-assets";
import type { AssetEmployeeOption } from "@/src/modules/assets/data/get-assets";
import { listChildAssets } from "@/src/modules/assets/lib/asset-kit";

export type AssetFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

/** Lazy employee roster for assign form — not loaded on every asset detail view. */
export async function loadAssetAssignEmployees(): Promise<AssetEmployeeOption[]> {
  if (!(await isFeatureEnabled("assets"))) {
    return [];
  }
  const actor = await requireActor("assets.manage");
  if (!actor.ok) {
    return [];
  }
  return getAssetAssignEmployees();
}

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

function parseRequiredDate(
  formData: FormData,
  key: string,
): { ok: true; value: Date } | { ok: false; message: string } {
  const raw = nullableText(formData, key);
  const parsed = parseOptionalDate(raw);
  if (!parsed) {
    return { ok: false, message: `Enter a valid ${key} (YYYY-MM-DD).` };
  }
  return { ok: true, value: parsed };
}

function toDateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseOptionalDecimal(value: string | null): Prisma.Decimal | null {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }
  return new Prisma.Decimal(value);
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

async function resolveOrganizationId(): Promise<string | null> {
  return getDefaultOrganizationId();
}

function validateAssetFields(formData: FormData) {
  const fieldErrors: Record<string, string> = {};

  const category = parseAssetCategory(textValue(formData, "category"));
  const assetType = parseAssetType(textValue(formData, "assetType"));
  const condition = parseAssetCondition(textValue(formData, "condition"));
  const status = parseAssetStatus(textValue(formData, "status"));

  if (!category) fieldErrors.category = "Select a category.";
  if (!assetType) fieldErrors.assetType = "Select an asset type.";
  if (!condition) fieldErrors.condition = "Select a condition.";
  if (!status) fieldErrors.status = "Select a status.";

  const purchaseCostRaw = nullableText(formData, "purchaseCost");
  const purchaseCost = parseOptionalDecimal(purchaseCostRaw);
  if (purchaseCostRaw && !purchaseCost) {
    fieldErrors.purchaseCost = "Enter a valid amount (e.g. 4500.00).";
  }

  const purchaseDateRaw = nullableText(formData, "purchaseDate");
  const receivedDateRaw = nullableText(formData, "receivedDate");
  const warrantyEndsOnRaw = nullableText(formData, "warrantyEndsOn");

  if (purchaseDateRaw && !parseOptionalDate(purchaseDateRaw)) {
    fieldErrors.purchaseDate = "Use YYYY-MM-DD.";
  }
  if (receivedDateRaw && !parseOptionalDate(receivedDateRaw)) {
    fieldErrors.receivedDate = "Use YYYY-MM-DD.";
  }
  if (warrantyEndsOnRaw && !parseOptionalDate(warrantyEndsOnRaw)) {
    fieldErrors.warrantyEndsOn = "Use YYYY-MM-DD.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      category: category!,
      assetType: assetType!,
      condition: condition!,
      status: status!,
      assetTag: nullableText(formData, "assetTag"),
      manufacturer: nullableText(formData, "manufacturer"),
      modelName: nullableText(formData, "modelName"),
      computerName: nullableText(formData, "computerName"),
      serialNumber: nullableText(formData, "serialNumber"),
      description: nullableText(formData, "description"),
      notes: nullableText(formData, "notes"),
      locationId: nullableText(formData, "locationId"),
      currencyCode: nullableText(formData, "currencyCode") ?? "TTD",
      purchaseCost,
      purchaseDate: parseOptionalDate(purchaseDateRaw),
      receivedDate: parseOptionalDate(receivedDateRaw),
      warrantyEndsOn: parseOptionalDate(warrantyEndsOnRaw),
    },
  };
}

function revalidateAssetPaths(assetId?: string, employeeId?: string | null) {
  revalidatePath("/assets");
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/assets/${assetId}/edit`);
  }
  if (employeeId) {
    revalidatePath(`/people/employees/${employeeId}/assets`);
  }
}

export async function createAsset(
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

  const validation = validateAssetFields(formData);
  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the asset details.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }
  const audit = await getAuditRequestMetadata(formData);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const assetNumber = await allocateAssetNumber(organizationId, tx);
      const asset = await tx.asset.create({
        data: {
          organizationId,
          assetNumber,
          ...validation.values,
          // Create as stock unless status already ASSIGNED — assignment is a separate action.
          assignedEmployeeId: null,
          status:
            validation.values.status === "ASSIGNED"
              ? "AVAILABLE"
              : validation.values.status,
        },
      });

      await tx.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          organizationId,
          moduleKey: "assets",
          action: "ASSET_CREATED",
          entityType: "Asset",
          entityId: asset.id,
          description: `Created asset ${asset.assetNumber}.`,
          newValues: {
            assetNumber: asset.assetNumber,
            assetType: asset.assetType,
            serialNumber: asset.serialNumber,
          },
          ...audit,
        },
      });

      return asset;
    });

    revalidateAssetPaths(created.id);
    redirect(`/assets/${created.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message:
          "That serial number is already registered. Check the register or clear the serial.",
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

export async function updateAsset(
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

  const id = textValue(formData, "id");
  if (!id) {
    return { status: "error", message: "Asset id is required." };
  }

  const validation = validateAssetFields(formData);
  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the asset details.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const existing = await prisma.asset.findFirst({
    where: {
      id,
      organizationId,
      archivedAt: null,
    },
    select: {
      id: true,
      assetNumber: true,
      assignedEmployeeId: true,
      status: true,
      organizationId: true,
    },
  });

  if (!existing) {
    return { status: "error", message: "Asset not found." };
  }

  // Keep custody status in sync: employee or office assignment stays ASSIGNED.
  const isInCustody =
    Boolean(existing.assignedEmployeeId) || existing.status === "ASSIGNED";
  const nextStatus = isInCustody
    ? "ASSIGNED"
    : validation.values.status === "ASSIGNED"
      ? "AVAILABLE"
      : validation.values.status;

  const audit = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: {
          ...validation.values,
          status: nextStatus,
          assignedEmployeeId: existing.assignedEmployeeId,
        },
      });

      await tx.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          organizationId: existing.organizationId,
          moduleKey: "assets",
          action: "ASSET_UPDATED",
          entityType: "Asset",
          entityId: id,
          description: `Updated asset ${existing.assetNumber}.`,
          ...audit,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message:
          "That serial number is already registered. Check the register or clear the serial.",
      };
    }
    throw error;
  }

  revalidateAssetPaths(id, existing.assignedEmployeeId);
  redirect(`/assets/${id}`);
}

export async function assignAsset(
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

  const assetId = textValue(formData, "assetId");
  const assigneeKind = textValue(formData, "assigneeKind") || "employee";
  const employeeId = nullableText(formData, "employeeId");
  const locationId = nullableText(formData, "locationId");
  const notes = nullableText(formData, "notes");
  const conditionAtIssue =
    parseAssetCondition(textValue(formData, "conditionAtIssue")) ?? undefined;
  const assignedAtResult = parseRequiredDate(formData, "assignedAt");
  if (!assignedAtResult.ok) {
    return { status: "error", message: "Enter the date this asset was assigned." };
  }
  const assignedAt = assignedAtResult.value;

  const previousReturnedAtRaw = nullableText(formData, "previousReturnedAt");
  const previousReturnedAt =
    parseOptionalDate(previousReturnedAtRaw) ?? assignedAt;

  if (!assetId) {
    return { status: "error", message: "Asset id is required." };
  }

  if (assigneeKind !== "employee" && assigneeKind !== "location") {
    return {
      status: "error",
      message: "Choose whether to assign to an employee or a location.",
    };
  }

  if (assigneeKind === "employee" && !employeeId) {
    return {
      status: "error",
      message: "Select an employee to assign this asset to.",
    };
  }

  if (assigneeKind === "location" && !locationId) {
    return {
      status: "error",
      message: "Select a location / office to assign this asset to.",
    };
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId, archivedAt: null },
  });

  if (!asset) {
    return { status: "error", message: "Asset not found." };
  }

  if (asset.parentAssetId) {
    return {
      status: "error",
      message:
        "This asset is paired under a parent. Assign the parent asset (paired children move with it), or unpair first.",
    };
  }

  if (
    asset.status === "RETIRED" ||
    asset.status === "LOST" ||
    asset.status === "STOLEN"
  ) {
    return {
      status: "error",
      message: `This asset is ${asset.status.toLowerCase()} and cannot be assigned.`,
    };
  }

  if (assigneeKind === "employee") {
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId!,
        organizationId,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!employee) {
      return { status: "error", message: "Employee not found." };
    }
  } else {
    const location = await prisma.location.findFirst({
      where: {
        id: locationId!,
        organizationId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!location) {
      return { status: "error", message: "Location not found." };
    }
  }

  const openAssignment = await prisma.assetAssignment.findFirst({
    where: {
      assetId,
      organizationId,
      returnedAt: null,
    },
    select: {
      id: true,
      assignedAt: true,
      employeeId: true,
      locationId: true,
    },
  });

  if (openAssignment && previousReturnedAt < openAssignment.assignedAt) {
    return {
      status: "error",
      message:
        "The previous return date cannot be before that assignment started.",
    };
  }

  if (openAssignment && assignedAt < previousReturnedAt) {
    return {
      status: "error",
      message:
        "The new assignment date cannot be before the previous custody ended.",
    };
  }

  const wasAssigned =
    Boolean(asset.assignedEmployeeId) || asset.status === "ASSIGNED";
  const changingCustodian =
    assigneeKind === "employee"
      ? asset.assignedEmployeeId !== employeeId
      : asset.locationId !== locationId || Boolean(asset.assignedEmployeeId);

  const assignmentTypeParsed = parseAssetAssignmentType(
    textValue(formData, "assignmentType"),
  );
  const effectiveType =
    wasAssigned && changingCustodian
      ? ("TRANSFER" as const)
      : assigneeKind === "location"
        ? (assignmentTypeParsed ?? "OFFICE")
        : (assignmentTypeParsed ?? "ISSUE");

  const previousEmployeeId = asset.assignedEmployeeId;
  const audit = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (tx) => {
      const children = await listChildAssets(tx, assetId, organizationId);
      const targets = [
        {
          id: asset.id,
          assetNumber: asset.assetNumber,
          condition: asset.condition,
          locationId: asset.locationId,
        },
        ...children.map((child) => ({
          id: child.id,
          assetNumber: child.assetNumber,
          condition: child.condition,
          locationId: child.locationId,
        })),
      ];

      for (const target of targets) {
        const open = await tx.assetAssignment.findFirst({
          where: {
            assetId: target.id,
            organizationId,
            returnedAt: null,
          },
          select: { id: true, assignedAt: true },
        });

        if (open) {
          if (previousReturnedAt < open.assignedAt) {
            throw new Error("PREVIOUS_RETURN_BEFORE_ASSIGN");
          }
          if (assignedAt < previousReturnedAt) {
            throw new Error("ASSIGN_BEFORE_PREVIOUS_RETURN");
          }
          await tx.assetAssignment.update({
            where: { id: open.id },
            data: { returnedAt: previousReturnedAt },
          });
        }

        await tx.assetAssignment.create({
          data: {
            organizationId,
            assetId: target.id,
            employeeId: assigneeKind === "employee" ? employeeId : null,
            locationId: assigneeKind === "location" ? locationId : null,
            assignmentType: effectiveType,
            assignedAt,
            notes:
              target.id === assetId
                ? notes
                : notes
                  ? `${notes} (moved with parent ${asset.assetNumber})`
                  : `Moved with parent ${asset.assetNumber}`,
            conditionAtIssue,
            assignedByUserId: actor.actor.userId,
          },
        });

        await tx.asset.update({
          where: { id: target.id },
          data: {
            assignedEmployeeId: assigneeKind === "employee" ? employeeId : null,
            locationId:
              assigneeKind === "location" ? locationId : target.locationId,
            status: "ASSIGNED",
            condition: conditionAtIssue ?? target.condition,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          organizationId,
          moduleKey: "assets",
          action: "ASSET_ASSIGNED",
          entityType: "Asset",
          entityId: assetId,
          description:
            assigneeKind === "employee"
              ? `Assigned ${asset.assetNumber} to employee ${employeeId} on ${toDateOnlyIso(assignedAt)}${
                  children.length
                    ? ` (with ${children.length} paired item${children.length === 1 ? "" : "s"})`
                    : ""
                }.`
              : `Assigned ${asset.assetNumber} to location ${locationId} on ${toDateOnlyIso(assignedAt)}${
                  children.length
                    ? ` (with ${children.length} paired item${children.length === 1 ? "" : "s"})`
                    : ""
                }.`,
          newValues: {
            assigneeKind,
            employeeId: assigneeKind === "employee" ? employeeId : null,
            locationId: assigneeKind === "location" ? locationId : null,
            assignmentType: effectiveType,
            assignedAt: toDateOnlyIso(assignedAt),
            childAssetIds: children.map((child) => child.id),
          },
          ...audit,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PREVIOUS_RETURN_BEFORE_ASSIGN") {
        return {
          status: "error",
          message:
            "The previous return date cannot be before an open assignment started (including a paired item).",
        };
      }
      if (error.message === "ASSIGN_BEFORE_PREVIOUS_RETURN") {
        return {
          status: "error",
          message:
            "The new assignment date cannot be before previous custody ended (including a paired item).",
        };
      }
    }
    throw error;
  }

  revalidateAssetPaths(assetId, previousEmployeeId);
  if (employeeId) {
    revalidateAssetPaths(assetId, employeeId);
  }
  redirect(`/assets/${assetId}`);
}

export async function returnAsset(
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

  const assetId = textValue(formData, "assetId");
  const notes = nullableText(formData, "notes");
  const conditionAtReturn =
    parseAssetCondition(textValue(formData, "conditionAtReturn")) ?? undefined;
  const nextStatus =
    parseAssetStatus(textValue(formData, "nextStatus")) ?? "AVAILABLE";
  const returnedAtResult = parseRequiredDate(formData, "returnedAt");
  if (!returnedAtResult.ok) {
    return { status: "error", message: "Enter the date this asset was returned." };
  }
  const returnedAt = returnedAtResult.value;

  if (!assetId) {
    return { status: "error", message: "Asset id is required." };
  }

  if (
    nextStatus !== "AVAILABLE" &&
    nextStatus !== "IN_REPAIR" &&
    nextStatus !== "RETIRED"
  ) {
    return {
      status: "error",
      message: "After return, status must be Available, In repair, or Retired.",
    };
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId, archivedAt: null },
  });

  if (!asset) {
    return { status: "error", message: "Asset not found." };
  }

  const isAssigned =
    Boolean(asset.assignedEmployeeId) || asset.status === "ASSIGNED";

  if (!isAssigned) {
    return { status: "error", message: "This asset is not currently assigned." };
  }

  const openAssignment = await prisma.assetAssignment.findFirst({
    where: {
      assetId,
      organizationId,
      returnedAt: null,
    },
    select: {
      id: true,
      assignedAt: true,
      employeeId: true,
      locationId: true,
    },
  });

  if (!openAssignment) {
    return {
      status: "error",
      message: "No open assignment was found to return.",
    };
  }

  if (returnedAt < openAssignment.assignedAt) {
    return {
      status: "error",
      message: "The return date cannot be before the assignment date.",
    };
  }

  const previousEmployeeId = asset.assignedEmployeeId;
  const audit = await getAuditRequestMetadata(formData);
  const wasOfficeAssignment =
    Boolean(openAssignment.locationId) && !openAssignment.employeeId;

  try {
    await prisma.$transaction(async (tx) => {
      const children = asset.parentAssetId
        ? []
        : await listChildAssets(tx, assetId, organizationId);
      const targets = [
        {
          id: asset.id,
          assetNumber: asset.assetNumber,
          condition: asset.condition,
        },
        ...children.map((child) => ({
          id: child.id,
          assetNumber: child.assetNumber,
          condition: child.condition,
        })),
      ];

      for (const target of targets) {
        const open = await tx.assetAssignment.findFirst({
          where: {
            assetId: target.id,
            organizationId,
            returnedAt: null,
          },
          select: {
            id: true,
            assignedAt: true,
            employeeId: true,
            locationId: true,
          },
        });

        if (!open) {
          if (target.id === assetId) {
            throw new Error("NO_OPEN_ASSIGNMENT");
          }
          continue;
        }

        if (returnedAt < open.assignedAt) {
          throw new Error("RETURN_BEFORE_ASSIGN");
        }

        const targetWasOffice =
          Boolean(open.locationId) && !open.employeeId;

        await tx.assetAssignment.update({
          where: { id: open.id },
          data: {
            returnedAt,
            conditionAtReturn,
            notes:
              target.id === assetId
                ? (notes ?? undefined)
                : notes
                  ? `${notes} (returned with parent ${asset.assetNumber})`
                  : `Returned with parent ${asset.assetNumber}`,
          },
        });

        await tx.asset.update({
          where: { id: target.id },
          data: {
            assignedEmployeeId: null,
            ...(targetWasOffice ||
            (target.id === assetId && wasOfficeAssignment)
              ? { locationId: null }
              : {}),
            status: nextStatus,
            condition: conditionAtReturn ?? target.condition,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          organizationId,
          moduleKey: "assets",
          action: "ASSET_RETURNED",
          entityType: "Asset",
          entityId: assetId,
          description: `Returned ${asset.assetNumber} on ${toDateOnlyIso(returnedAt)}; status ${nextStatus}${
            children.length
              ? ` (with ${children.length} paired item${children.length === 1 ? "" : "s"})`
              : ""
          }.`,
          newValues: {
            nextStatus,
            returnedAt: toDateOnlyIso(returnedAt),
            childAssetIds: children.map((child) => child.id),
          },
          ...audit,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RETURN_BEFORE_ASSIGN") {
        return {
          status: "error",
          message:
            "The return date cannot be before an assignment started (including a paired item).",
        };
      }
      if (error.message === "NO_OPEN_ASSIGNMENT") {
        return {
          status: "error",
          message: "No open assignment was found to return.",
        };
      }
    }
    throw error;
  }

  revalidateAssetPaths(assetId, previousEmployeeId);
  redirect(`/assets/${assetId}`);
}

/**
 * Correct custody dates on an existing movement without creating a new assignment.
 */
export async function updateAssetAssignment(
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

  const assignmentId = textValue(formData, "assignmentId");
  const assetId = textValue(formData, "assetId");
  const assignedAtResult = parseRequiredDate(formData, "assignedAt");
  if (!assignedAtResult.ok) {
    return {
      status: "error",
      message: "Enter the date this asset was assigned.",
    };
  }
  const assignedAt = assignedAtResult.value;

  const returnedAtRaw = nullableText(formData, "returnedAt");
  const returnedAt = parseOptionalDate(returnedAtRaw);

  if (returnedAtRaw && !returnedAt) {
    return {
      status: "error",
      message: "Enter a valid return date (YYYY-MM-DD).",
    };
  }

  if (returnedAt && returnedAt < assignedAt) {
    return {
      status: "error",
      message: "The return date cannot be before the assignment date.",
    };
  }

  if (!assignmentId || !assetId) {
    return { status: "error", message: "Assignment is required." };
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const assignment = await prisma.assetAssignment.findFirst({
    where: { id: assignmentId, assetId, organizationId },
    select: {
      id: true,
      assignedAt: true,
      returnedAt: true,
      employeeId: true,
      locationId: true,
      asset: { select: { assetNumber: true, assignedEmployeeId: true } },
    },
  });

  if (!assignment) {
    return { status: "error", message: "Assignment not found." };
  }

  const wasOpen = assignment.returnedAt === null;
  const willBeOpen = returnedAt === null;

  // Only one open assignment per asset.
  if (willBeOpen && !wasOpen) {
    const otherOpen = await prisma.assetAssignment.findFirst({
      where: {
        assetId,
        organizationId,
        returnedAt: null,
        id: { not: assignmentId },
      },
      select: { id: true },
    });
    if (otherOpen) {
      return {
        status: "error",
        message:
          "Another open assignment already exists. Return or close it before reopening this one.",
      };
    }
  }

  const audit = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (tx) => {
    await tx.assetAssignment.update({
      where: { id: assignmentId },
      data: {
        assignedAt,
        returnedAt,
      },
    });

    if (wasOpen && !willBeOpen) {
      const wasOfficeAssignment =
        Boolean(assignment.locationId) && !assignment.employeeId;
      await tx.asset.update({
        where: { id: assetId },
        data: {
          assignedEmployeeId: null,
          ...(wasOfficeAssignment ? { locationId: null } : {}),
          status: "AVAILABLE",
        },
      });
    }

    if (!wasOpen && willBeOpen) {
      await tx.asset.update({
        where: { id: assetId },
        data: {
          assignedEmployeeId: assignment.employeeId,
          locationId: assignment.locationId ?? undefined,
          status: "ASSIGNED",
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        organizationId,
        moduleKey: "assets",
        action: "ASSET_ASSIGNMENT_UPDATED",
        entityType: "AssetAssignment",
        entityId: assignmentId,
        description: `Updated custody dates for ${assignment.asset.assetNumber}.`,
        oldValues: {
          assignedAt: toDateOnlyIso(assignment.assignedAt),
          returnedAt: assignment.returnedAt
            ? toDateOnlyIso(assignment.returnedAt)
            : null,
        },
        newValues: {
          assignedAt: toDateOnlyIso(assignedAt),
          returnedAt: returnedAt ? toDateOnlyIso(returnedAt) : null,
        },
        ...audit,
      },
    });
  });

  revalidateAssetPaths(assetId, assignment.employeeId);
  redirect(`/assets/${assetId}`);
}

