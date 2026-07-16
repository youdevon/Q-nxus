import { prisma } from "@/lib/prisma";

export type EmployeeFormDepartment = {
  id: string;
  name: string;
  positions: {
    id: string;
    title: string;
  }[];
};

export type EmployeeFormRecord = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  employmentStatus: string;
  employmentType: string;
  hireDate: string;
  terminationDate: string | null;
  departmentId: string | null;
  positionId: string | null;
  isArchived: boolean;
  updatedAt: string;
};

export async function getEmployeeFormOptions(): Promise<
  EmployeeFormDepartment[]
> {
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

  return prisma.department.findMany({
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
      positions: {
        where: {
          isActive: true,
        },
        orderBy: {
          title: "asc",
        },
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

export async function getEmployeeById(
  id: string,
): Promise<EmployeeFormRecord | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      preferredName: true,
      workEmail: true,
      personalEmail: true,
      phone: true,
      employmentStatus: true,
      employmentType: true,
      hireDate: true,
      terminationDate: true,
      departmentId: true,
      positionId: true,
      isArchived: true,
      updatedAt: true,
    },
  });

  if (!employee) {
    return null;
  }

  return {
    ...employee,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate.toISOString().slice(0, 10),
    terminationDate:
      employee.terminationDate?.toISOString().slice(0, 10) ?? null,
    updatedAt: employee.updatedAt.toISOString(),
  };
}

export type EmployeeProfileRecord = EmployeeFormRecord & {
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  position: {
    id: string;
    title: string;
    code: string | null;
    description: string | null;
  } | null;
  currentContract: {
    id: string;
    jobTitle: string;
    startDate: string;
    endDate: string | null;
    baseSalary: string;
    currency: string;
  } | null;
  contractCount: number;
};

export async function getEmployeeProfile(
  id: string,
): Promise<EmployeeProfileRecord | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      preferredName: true,
      workEmail: true,
      personalEmail: true,
      phone: true,
      employmentStatus: true,
      employmentType: true,
      hireDate: true,
      terminationDate: true,
      departmentId: true,
      positionId: true,
      isArchived: true,
      updatedAt: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      position: {
        select: {
          id: true,
          title: true,
          code: true,
          description: true,
        },
      },
      contracts: {
        orderBy: {
          startDate: "desc",
        },
        select: {
          id: true,
          jobTitle: true,
          startDate: true,
          endDate: true,
          baseSalary: true,
          currency: true,
          isCurrent: true,
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  const currentContract =
    employee.contracts.find((contract) => contract.isCurrent) ?? null;

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,
    preferredName: employee.preferredName,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail,
    phone: employee.phone,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate.toISOString().slice(0, 10),
    terminationDate:
      employee.terminationDate?.toISOString().slice(0, 10) ?? null,
    departmentId: employee.departmentId,
    positionId: employee.positionId,
    isArchived: employee.isArchived,
    updatedAt: employee.updatedAt.toISOString(),
    department: employee.department,
    position: employee.position,
    currentContract: currentContract
      ? {
          id: currentContract.id,
          jobTitle: currentContract.jobTitle,
          startDate: currentContract.startDate.toISOString().slice(0, 10),
          endDate: currentContract.endDate?.toISOString().slice(0, 10) ?? null,
          baseSalary: currentContract.baseSalary.toString(),
          currency: currentContract.currency,
        }
      : null,
    contractCount: employee.contracts.length,
  };
}
