import { prisma } from "@/lib/prisma"
import type { EmployeeFormDepartment } from "./get-employee-form-data"
import { getEmployeeFormOptions } from "./get-employee-form-data"

export type EmployeeAssignmentRecord = {
  id: string
  assignmentType: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  isActing: boolean
  referenceNumber: string | null
  reason: string | null
  notes: string | null
  createdAt: string
  department: {
    id: string
    name: string
    code: string | null
  }
  position: {
    id: string
    title: string
    code: string | null
  } | null
  jobDescription: {
    id: string
    versionNumber: number
    title: string
  } | null
}

export type EmployeeAssignmentHistory = {
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    hireDate: string
    updatedAt: string
    departmentId: string | null
    positionId: string | null
  }
  assignments: EmployeeAssignmentRecord[]
}

export async function getEmployeeAssignmentHistory(
  employeeId: string,
): Promise<EmployeeAssignmentHistory | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      updatedAt: true,
      departmentId: true,
      positionId: true,
      assignments: {
        orderBy: [
          {
            isCurrent: "desc",
          },
          {
            startDate: "desc",
          },
        ],
        select: {
          id: true,
          assignmentType: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          isActing: true,
          referenceNumber: true,
          reason: true,
          notes: true,
          createdAt: true,
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
            },
          },
          jobDescription: {
            select: {
              id: true,
              versionNumber: true,
              title: true,
            },
          },
        },
      },
    },
  })

  if (!employee) {
    return null
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      updatedAt: employee.updatedAt.toISOString(),
      departmentId: employee.departmentId,
      positionId: employee.positionId,
    },
    assignments: employee.assignments.map((assignment) => ({
      id: assignment.id,
      assignmentType: assignment.assignmentType,
      startDate: assignment.startDate.toISOString().slice(0, 10),
      endDate:
        assignment.endDate?.toISOString().slice(0, 10) ?? null,
      isCurrent: assignment.isCurrent,
      isActing: assignment.isActing,
      referenceNumber: assignment.referenceNumber,
      reason: assignment.reason,
      notes: assignment.notes,
      createdAt: assignment.createdAt.toISOString(),
      department: assignment.department,
      position: assignment.position,
      jobDescription: assignment.jobDescription,
    })),
  }
}

export async function getAssignmentFormData(
  employeeId: string,
): Promise<{
  history: EmployeeAssignmentHistory | null
  departments: EmployeeFormDepartment[]
}> {
  const [history, departments] = await Promise.all([
    getEmployeeAssignmentHistory(employeeId),
    getEmployeeFormOptions(),
  ])

  return {
    history,
    departments,
  }
}

export type PositionAssignmentEmployeeOption = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  hireDate: string
  updatedAt: string
  departmentName: string | null
  positionTitle: string | null
}

export type PositionAssignmentFormData = {
  position: {
    id: string
    title: string
    code: string | null
    departmentId: string
    departmentName: string
  }
  employees: PositionAssignmentEmployeeOption[]
}

export async function getPositionAssignmentFormData(
  positionId: string,
): Promise<PositionAssignmentFormData | null> {
  const position = await prisma.position.findUnique({
    where: {
      id: positionId,
    },
    select: {
      id: true,
      title: true,
      code: true,
      isActive: true,
      department: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
  })

  if (!position || !position.isActive) {
    return null
  }

  const employees = await prisma.employee.findMany({
    where: {
      organizationId: position.department.organizationId,
      isArchived: false,
      employmentStatus: {
        in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"],
      },
      OR: [
        {
          positionId: null,
        },
        {
          positionId: {
            not: positionId,
          },
        },
      ],
    },
    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
    ],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      updatedAt: true,
      department: {
        select: {
          name: true,
        },
      },
      position: {
        select: {
          title: true,
        },
      },
    },
  })

  return {
    position: {
      id: position.id,
      title: position.title,
      code: position.code,
      departmentId: position.department.id,
      departmentName: position.department.name,
    },
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      updatedAt: employee.updatedAt.toISOString(),
      departmentName: employee.department?.name ?? null,
      positionTitle: employee.position?.title ?? null,
    })),
  }
}
