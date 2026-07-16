import { prisma } from "@/lib/prisma";

export type LocationListItem = {
  id: string;
  code: string;
  name: string;
  locationType: string;
  city: string | null;
  region: string | null;
  countryCode: string;
  timeZone: string;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  updatedAt: Date;
};

export type LocationRecord = LocationListItem & {
  organizationId: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
};

export type LocationTypeOption = {
  code: string;
  label: string;
};

export async function getLocations(): Promise<LocationListItem[]> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  return prisma.location.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      code: true,
      name: true,
      locationType: true,
      city: true,
      region: true,
      countryCode: true,
      timeZone: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      updatedAt: true,
    },
  });
}

export async function getLocation(id: string): Promise<LocationRecord | null> {
  return prisma.location.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      organizationId: true,
      code: true,
      name: true,
      locationType: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      countryCode: true,
      postalCode: true,
      timeZone: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      updatedAt: true,
    },
  });
}

export async function getLocationTypes(): Promise<LocationTypeOption[]> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  const dataSet = await prisma.referenceDataSet.findFirst({
    where: {
      code: "LOCATION_TYPE",
      status: "ACTIVE",
      OR: [
        {
          organizationId: organization.id,
        },
        {
          organizationId: null,
        },
      ],
    },
    select: {
      values: {
        where: {
          status: "ACTIVE",
        },
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            label: "asc",
          },
        ],
        select: {
          code: true,
          label: true,
        },
      },
    },
  });

  return dataSet?.values ?? [];
}
