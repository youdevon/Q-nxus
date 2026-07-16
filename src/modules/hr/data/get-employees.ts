import {
  EmploymentStatus,
  EmploymentType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

export type EmployeeDirectoryFilters = {
  query?: string;
  status?: string;
  employmentType?: string;
  departmentId?: string;
  page?: number;
  show?: string;
};

export type EmployeeDirectoryItem = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  phone: string | null;
  employmentStatus: string;
  employmentType: string;
  hireDate: string;
  department: {
    id: string;
    name: string;
  } | null;
  position: {
    id: string;
    title: string;
  } | null;
};

export type EmployeeDirectoryData = {
  employees: EmployeeDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  listing: boolean;
  departments: {
    id: string;
    name: string;
  }[];
  summary: {
    active: number;
  };
};

export function isEmployeeDirectoryListing(
  filters: EmployeeDirectoryFilters,
): boolean {
  return (
    filters.show === "all" ||
    Boolean(filters.query?.trim()) ||
    Boolean(filters.status) ||
    Boolean(filters.employmentType) ||
    Boolean(filters.departmentId)
  );
}

export async function getEmployees(
  filters: EmployeeDirectoryFilters,
): Promise<EmployeeDirectoryData> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return {
      employees: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: 1,
      listing: false,
      departments: [],
      summary: {
        active: 0,
      },
    };
  }

  const listing = isEmployeeDirectoryListing(filters);
  const page =
    Number.isInteger(filters.page) && Number(filters.page) > 0
      ? Number(filters.page)
      : 1;

  const query = filters.query?.trim();

  const validStatus = Object.values(EmploymentStatus).includes(
    filters.status as EmploymentStatus,
  )
    ? (filters.status as EmploymentStatus)
    : undefined;

  const validEmploymentType = Object.values(EmploymentType).includes(
    filters.employmentType as EmploymentType,
  )
    ? (filters.employmentType as EmploymentType)
    : undefined;

  const where: Prisma.EmployeeWhereInput = {
    organizationId: organization.id,
    isArchived: false,
    ...(validStatus
      ? {
          employmentStatus: validStatus,
        }
      : {}),
    ...(validEmploymentType
      ? {
          employmentType: validEmploymentType,
        }
      : {}),
    ...(filters.departmentId
      ? {
          departmentId: filters.departmentId,
        }
      : {}),
    ...(query
      ? {
          OR: [
            {
              employeeNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              firstName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              middleName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              preferredName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              workEmail: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              personalEmail: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [employees, total, departments, active] = await Promise.all([
    listing
      ? prisma.employee.findMany({
          where,
          orderBy: [
            {
              lastName: "asc",
            },
            {
              firstName: "asc",
            },
          ],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            preferredName: true,
            workEmail: true,
            phone: true,
            employmentStatus: true,
            employmentType: true,
            hireDate: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            position: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : Promise.resolve([]),

    listing
      ? prisma.employee.count({
          where,
        })
      : Promise.resolve(0),

    prisma.department.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),

    prisma.employee.count({
      where: {
        organizationId: organization.id,
        isArchived: false,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    }),
  ]);

  return {
    employees: employees.map((employee) => ({
      ...employee,
      employmentStatus: employee.employmentStatus,
      employmentType: employee.employmentType,
      hireDate: employee.hireDate.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    listing,
    departments,
    summary: {
      active,
    },
  };
}
