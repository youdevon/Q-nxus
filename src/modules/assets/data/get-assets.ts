import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AssetType,
  Prisma,
} from "@/generated/prisma/client";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import { warrantyFilterCutoff } from "@/src/modules/assets/lib/asset-enums";

export type AssetRegisterFilters = {
  query?: string;
  status?: AssetStatus | null;
  assetType?: AssetType | null;
  category?: AssetCategory | null;
  /** Currently assigned employee (register filter or employee profile tab). */
  assignedEmployeeId?: string | null;
  warrantyWithinDays?: number | null;
  warrantyExpiredOnly?: boolean;
  /** 1-based page for the register list. Export should omit / use pageSize unbounded. */
  page?: number;
  pageSize?: number;
};

export type AssetRegisterRow = {
  id: string;
  assetNumber: string;
  assetTag: string | null;
  category: AssetCategory;
  assetType: AssetType;
  manufacturer: string | null;
  modelName: string | null;
  serialNumber: string | null;
  computerName: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  warrantyEndsOn: string | null;
  purchaseDate: string | null;
  assignedEmployee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
  } | null;
  location: {
    id: string;
    code: string;
    name: string;
  } | null;
  /** Open custody: employee and/or office location. */
  openAssignment: {
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
    } | null;
    location: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  parentAsset: {
    id: string;
    assetNumber: string;
  } | null;
  childCount: number;
};

export type AssetRegisterData = {
  rows: AssetRegisterRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const REGISTER_PAGE_SIZE = 50;

export const getDefaultOrganizationId = cache(async (): Promise<string | null> => {
  return getSessionOrganizationId();
});

function toDateOnlyIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function buildWhere(
  organizationId: string,
  filters: AssetRegisterFilters,
): Prisma.AssetWhereInput {
  const and: Prisma.AssetWhereInput[] = [
    { organizationId },
    { archivedAt: null },
  ];

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.assetType) {
    and.push({ assetType: filters.assetType });
  }

  if (filters.category) {
    and.push({ category: filters.category });
  }

  if (filters.assignedEmployeeId) {
    and.push({ assignedEmployeeId: filters.assignedEmployeeId });
  }

  if (filters.warrantyExpiredOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    and.push({
      warrantyEndsOn: {
        not: null,
        lt: today,
      },
    });
  } else if (
    filters.warrantyWithinDays != null &&
    filters.warrantyWithinDays >= 0
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    and.push({
      warrantyEndsOn: {
        not: null,
        gte: today,
        lte: warrantyFilterCutoff(filters.warrantyWithinDays, today),
      },
    });
  }

  const query = filters.query?.trim();
  if (query) {
    and.push({
      OR: [
        { assetNumber: { contains: query, mode: "insensitive" } },
        { assetTag: { contains: query, mode: "insensitive" } },
        { manufacturer: { contains: query, mode: "insensitive" } },
        { modelName: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { computerName: { contains: query, mode: "insensitive" } },
        {
          assignedEmployee: {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { employeeNumber: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }

  return { AND: and };
}

const assetRegisterSelect = {
  id: true,
  assetNumber: true,
  assetTag: true,
  category: true,
  assetType: true,
  manufacturer: true,
  modelName: true,
  serialNumber: true,
  computerName: true,
  status: true,
  condition: true,
  warrantyEndsOn: true,
  purchaseDate: true,
  assignedEmployee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  location: {
    select: { id: true, code: true, name: true },
  },
  parentAsset: {
    select: { id: true, assetNumber: true },
  },
  _count: {
    select: { childAssets: true },
  },
} satisfies Prisma.AssetSelect;

/** Same shape as register — kept for export naming clarity. */
const assetExportSelect = assetRegisterSelect;

function mapRegisterRow(row: {
  id: string;
  assetNumber: string;
  assetTag: string | null;
  category: AssetCategory;
  assetType: AssetType;
  manufacturer: string | null;
  modelName: string | null;
  serialNumber: string | null;
  computerName: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  warrantyEndsOn: Date | null;
  purchaseDate: Date | null;
  assignedEmployee: AssetRegisterRow["assignedEmployee"];
  location: AssetRegisterRow["location"];
  parentAsset: AssetRegisterRow["parentAsset"];
  _count: { childAssets: number };
}): AssetRegisterRow {
  const officeAssignment =
    row.status === "ASSIGNED" && !row.assignedEmployee && row.location
      ? { employee: null, location: row.location }
      : null;

  return {
    id: row.id,
    assetNumber: row.assetNumber,
    assetTag: row.assetTag,
    category: row.category,
    assetType: row.assetType,
    manufacturer: row.manufacturer,
    modelName: row.modelName,
    serialNumber: row.serialNumber,
    computerName: row.computerName,
    status: row.status,
    condition: row.condition,
    warrantyEndsOn: toDateOnlyIso(row.warrantyEndsOn),
    purchaseDate: toDateOnlyIso(row.purchaseDate),
    assignedEmployee: row.assignedEmployee,
    location: row.location,
    openAssignment: row.assignedEmployee
      ? { employee: row.assignedEmployee, location: null }
      : officeAssignment,
    parentAsset: row.parentAsset,
    childCount: row._count.childAssets,
  };
}

export async function getAssetRegister(
  filters: AssetRegisterFilters = {},
): Promise<AssetRegisterData> {
  const organizationId = await getDefaultOrganizationId();

  if (!organizationId) {
    return { rows: [], totalCount: 0, page: 1, pageSize: REGISTER_PAGE_SIZE, totalPages: 0 };
  }

  const where = buildWhere(organizationId, filters);
  const pageSize =
    filters.pageSize && filters.pageSize > 0
      ? Math.min(filters.pageSize, 500)
      : REGISTER_PAGE_SIZE;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const unbounded = filters.pageSize === 0;

  const [rows, totalCount] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ assetNumber: "asc" }],
      select: assetRegisterSelect,
      ...(unbounded
        ? {}
        : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
    prisma.asset.count({ where }),
  ]);

  const effectivePageSize = unbounded ? totalCount || 1 : pageSize;

  return {
    totalCount,
    page: unbounded ? 1 : page,
    pageSize: effectivePageSize,
    totalPages: unbounded ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)),
    rows: rows.map(mapRegisterRow),
  };
}

/**
 * All matching rows for Excel — skips pagination count and nested open-assignment joins.
 */
export async function getAssetRegisterExportRows(
  filters: Omit<AssetRegisterFilters, "page" | "pageSize"> = {},
): Promise<AssetRegisterRow[]> {
  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return [];
  }

  const rows = await prisma.asset.findMany({
    where: buildWhere(organizationId, filters),
    orderBy: [{ assetNumber: "asc" }],
    select: assetExportSelect,
  });

  return rows.map(mapRegisterRow);
}

export type AssetKitMember = {
  id: string;
  assetNumber: string;
  assetType: AssetType;
  manufacturer: string | null;
  modelName: string | null;
  serialNumber: string | null;
  status: AssetStatus;
};

export type AssetDetail = {
  id: string;
  assetNumber: string;
  assetTag: string | null;
  category: AssetCategory;
  assetType: AssetType;
  manufacturer: string | null;
  modelName: string | null;
  computerName: string | null;
  serialNumber: string | null;
  description: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  purchaseDate: string | null;
  receivedDate: string | null;
  purchaseCost: string | null;
  currencyCode: string;
  warrantyEndsOn: string | null;
  notes: string | null;
  assignedEmployeeId: string | null;
  locationId: string | null;
  parentAssetId: string | null;
  assignedEmployee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
  } | null;
  location: {
    id: string;
    code: string;
    name: string;
  } | null;
  parentAsset: AssetKitMember | null;
  childAssets: AssetKitMember[];
  assignments: Array<{
    id: string;
    assignmentType: string;
    assignedAt: string;
    returnedAt: string | null;
    conditionAtIssue: string | null;
    conditionAtReturn: string | null;
    notes: string | null;
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
    } | null;
    location: {
      id: string;
      code: string;
      name: string;
    } | null;
  }>;
};

const kitMemberSelect = {
  id: true,
  assetNumber: true,
  assetType: true,
  manufacturer: true,
  modelName: true,
  serialNumber: true,
  status: true,
} satisfies Prisma.AssetSelect;

/** Full detail + custody history. Request-deduped for metadata + page. */
export const getAssetById = cache(async function getAssetById(
  id: string,
): Promise<AssetDetail | null> {
  const asset = await prisma.asset.findFirst({
    where: { id, archivedAt: null },
    include: {
      assignedEmployee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
      location: {
        select: { id: true, code: true, name: true },
      },
      parentAsset: { select: kitMemberSelect },
      childAssets: {
        where: { archivedAt: null },
        orderBy: { assetNumber: "asc" },
        select: kitMemberSelect,
      },
      assignments: {
        orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          assignmentType: true,
          assignedAt: true,
          returnedAt: true,
          conditionAtIssue: true,
          conditionAtReturn: true,
          notes: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });

  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    assetNumber: asset.assetNumber,
    assetTag: asset.assetTag,
    category: asset.category,
    assetType: asset.assetType,
    manufacturer: asset.manufacturer,
    modelName: asset.modelName,
    computerName: asset.computerName,
    serialNumber: asset.serialNumber,
    description: asset.description,
    status: asset.status,
    condition: asset.condition,
    purchaseDate: toDateOnlyIso(asset.purchaseDate),
    receivedDate: toDateOnlyIso(asset.receivedDate),
    purchaseCost: asset.purchaseCost?.toString() ?? null,
    currencyCode: asset.currencyCode,
    warrantyEndsOn: toDateOnlyIso(asset.warrantyEndsOn),
    notes: asset.notes,
    assignedEmployeeId: asset.assignedEmployeeId,
    locationId: asset.locationId,
    parentAssetId: asset.parentAssetId,
    assignedEmployee: asset.assignedEmployee,
    location: asset.location,
    parentAsset: asset.parentAsset,
    childAssets: asset.childAssets,
    assignments: asset.assignments.map((assignment) => ({
      id: assignment.id,
      assignmentType: assignment.assignmentType,
      assignedAt: assignment.assignedAt.toISOString(),
      returnedAt: assignment.returnedAt?.toISOString() ?? null,
      conditionAtIssue: assignment.conditionAtIssue,
      conditionAtReturn: assignment.conditionAtReturn,
      notes: assignment.notes,
      employee: assignment.employee,
      location: assignment.location,
    })),
  };
});

/** Edit form fields only — no assignment history. */
export const getAssetForEdit = cache(async function getAssetForEdit(
  id: string,
): Promise<AssetDetail | null> {
  const asset = await prisma.asset.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      assetNumber: true,
      assetTag: true,
      category: true,
      assetType: true,
      manufacturer: true,
      modelName: true,
      computerName: true,
      serialNumber: true,
      description: true,
      status: true,
      condition: true,
      purchaseDate: true,
      receivedDate: true,
      purchaseCost: true,
      currencyCode: true,
      warrantyEndsOn: true,
      notes: true,
      assignedEmployeeId: true,
      locationId: true,
      parentAssetId: true,
      assignedEmployee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
      location: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  if (!asset) {
    return null;
  }

  return {
    ...asset,
    parentAssetId: asset.parentAssetId ?? null,
    purchaseDate: toDateOnlyIso(asset.purchaseDate),
    receivedDate: toDateOnlyIso(asset.receivedDate),
    purchaseCost: asset.purchaseCost?.toString() ?? null,
    warrantyEndsOn: toDateOnlyIso(asset.warrantyEndsOn),
    parentAsset: null,
    childAssets: [],
    assignments: [],
  };
});

export type AssetLocationOption = {
  id: string;
  code: string;
  name: string;
};

export type AssetEmployeeOption = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
};

export type AssetPairOption = {
  id: string;
  assetNumber: string;
  assetType: AssetType;
  manufacturer: string | null;
  modelName: string | null;
  serialNumber: string | null;
};

/**
 * Unpaired accessories that can become children of `parentAssetId`.
 */
export const getPairableChildAssets = cache(async function getPairableChildAssets(
  parentAssetId: string,
): Promise<AssetPairOption[]> {
  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return [];
  }

  return prisma.asset.findMany({
    where: {
      organizationId,
      archivedAt: null,
      id: { not: parentAssetId },
      parentAssetId: null,
      childAssets: { none: {} },
      status: { in: ["AVAILABLE", "ASSIGNED"] },
    },
    orderBy: [{ assetNumber: "asc" }],
    take: 200,
    select: {
      id: true,
      assetNumber: true,
      assetType: true,
      manufacturer: true,
      modelName: true,
      serialNumber: true,
    },
  });
});

export type AssetFormOptions = {
  employees: AssetEmployeeOption[];
  locations: AssetLocationOption[];
};

/** Locations for create/edit forms (no employee roster). */
export const getAssetLocations = cache(async function getAssetLocations(): Promise<
  AssetLocationOption[]
> {
  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return [];
  }

  return prisma.location.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });
});

/** Employees for assign UI — call only when the assign form opens. */
export async function getAssetAssignEmployees(): Promise<AssetEmployeeOption[]> {
  const organizationId = await getDefaultOrganizationId();
  if (!organizationId) {
    return [];
  }

  return prisma.employee.findMany({
    where: {
      organizationId,
      isArchived: false,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  });
}

/** Locations (+ empty employees) for assign UI shell on asset detail. */
export const getAssetAssignOptions = cache(async function getAssetAssignOptions(): Promise<AssetFormOptions> {
  const locations = await getAssetLocations();
  return { employees: [], locations };
});
