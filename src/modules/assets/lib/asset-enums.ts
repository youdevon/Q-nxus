/**
 * Asset enum labels/values for UI + parsing (client-safe).
 * Keep in sync with prisma `assets` enums — do not import Prisma here.
 */

export const ASSET_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "IN_REPAIR",
  "RETIRED",
  "LOST",
  "STOLEN",
] as const;

export const ASSET_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR"] as const;

export const ASSET_CATEGORIES = [
  "COMPUTER_EQUIPMENT",
  "MOBILE_DEVICES",
  "OFFICE_EQUIPMENT",
  "FURNITURE",
  "OTHER",
] as const;

export const ASSET_TYPES = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "PHONE",
  "TABLET",
  "DOCK",
  "KEYBOARD",
  "MOUSE",
  "PRINTER",
  "OTHER",
] as const;

export const ASSET_ASSIGNMENT_TYPES = [
  "ISSUE",
  "TRANSFER",
  "RETURN",
  "OFFBOARDING",
  "LOAN",
  "REPLACEMENT",
  "OFFICE",
] as const;

export type AssetStatusValue = (typeof ASSET_STATUSES)[number];
export type AssetConditionValue = (typeof ASSET_CONDITIONS)[number];
export type AssetCategoryValue = (typeof ASSET_CATEGORIES)[number];
export type AssetTypeValue = (typeof ASSET_TYPES)[number];
export type AssetAssignmentTypeValue =
  (typeof ASSET_ASSIGNMENT_TYPES)[number];

export function labelAssetEnum(value: string): string {
  if (value === "COMPUTER_EQUIPMENT") {
    return "Equipment";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function includesValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}

export function parseAssetStatus(
  value: string | undefined,
): AssetStatusValue | null {
  if (!value) return null;
  return includesValue(ASSET_STATUSES, value) ? value : null;
}

export function parseAssetType(
  value: string | undefined,
): AssetTypeValue | null {
  if (!value) return null;
  return includesValue(ASSET_TYPES, value) ? value : null;
}

export function parseAssetCategory(
  value: string | undefined,
): AssetCategoryValue | null {
  if (!value) return null;
  return includesValue(ASSET_CATEGORIES, value) ? value : null;
}

export function parseAssetCondition(
  value: string | undefined,
): AssetConditionValue | null {
  if (!value) return null;
  return includesValue(ASSET_CONDITIONS, value) ? value : null;
}

export function parseAssetAssignmentType(
  value: string | undefined,
): AssetAssignmentTypeValue | null {
  if (!value) return null;
  return includesValue(ASSET_ASSIGNMENT_TYPES, value) ? value : null;
}

/** Warranty expiring within N days, or already expired (days <= 0). */
export function warrantyFilterCutoff(days: number, from = new Date()): Date {
  const cutoff = new Date(from);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + days);
  return cutoff;
}
