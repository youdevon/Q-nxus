import type { EmployeeFormDepartment } from "@/src/modules/hr/data/get-employee-form-data";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";

/** Shape returned when creating a position from a structure dialog. */
export type CreatedPositionEntity = {
  id: string;
  title: string;
  departmentId: string;
};

/** Shape returned when creating a department from a structure dialog. */
export type CreatedDepartmentEntity = {
  id: string;
  name: string;
};

export function toStructureDepartments(
  departments: EmployeeFormDepartment[],
): DepartmentRecord[] {
  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: null,
    description: null,
    isActive: true,
    updatedAt: "",
    employeeCount: 0,
    positions: department.positions.map((position) => ({
      id: position.id,
      title: position.title,
      code: null,
      description: null,
      systemRoleCode: null,
      reportsToPositionId: null,
      isActive: true,
      updatedAt: "",
      employeeCount: 0,
    })),
  }));
}

export function appendPositionToDepartments(
  departments: EmployeeFormDepartment[],
  created: CreatedPositionEntity,
): EmployeeFormDepartment[] {
  return departments.map((department) => {
    if (department.id !== created.departmentId) {
      return department;
    }

    if (department.positions.some((position) => position.id === created.id)) {
      return department;
    }

    return {
      ...department,
      positions: [...department.positions, { id: created.id, title: created.title }].sort(
        (left, right) => left.title.localeCompare(right.title),
      ),
    };
  });
}

export function appendDepartmentOption(
  departments: EmployeeFormDepartment[],
  created: CreatedDepartmentEntity,
): EmployeeFormDepartment[] {
  if (departments.some((department) => department.id === created.id)) {
    return departments;
  }

  return [
    ...departments,
    { id: created.id, name: created.name, positions: [] },
  ].sort((left, right) => left.name.localeCompare(right.name));
}
