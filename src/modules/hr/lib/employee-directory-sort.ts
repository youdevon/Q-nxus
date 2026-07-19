import type { Prisma } from "@/generated/prisma/client";

export const EMPLOYEE_DIRECTORY_SORT_FIELDS = [
  "name",
  "number",
  "department",
  "position",
  "type",
  "status",
  "hireDate",
] as const;

export type EmployeeDirectorySortField =
  (typeof EMPLOYEE_DIRECTORY_SORT_FIELDS)[number];

export type EmployeeDirectorySortOrder = "asc" | "desc";

export const DEFAULT_EMPLOYEE_DIRECTORY_SORT: EmployeeDirectorySortField =
  "name";
export const DEFAULT_EMPLOYEE_DIRECTORY_ORDER: EmployeeDirectorySortOrder =
  "asc";

const DEFAULT_ORDER_BY_FIELD: Record<
  EmployeeDirectorySortField,
  EmployeeDirectorySortOrder
> = {
  name: "asc",
  number: "asc",
  department: "asc",
  position: "asc",
  type: "asc",
  status: "asc",
  hireDate: "desc",
};

function isSortField(value: string): value is EmployeeDirectorySortField {
  return (EMPLOYEE_DIRECTORY_SORT_FIELDS as readonly string[]).includes(value);
}

export function parseEmployeeDirectorySort(params: {
  sort?: string;
  order?: string;
}): {
  sort: EmployeeDirectorySortField;
  order: EmployeeDirectorySortOrder;
} {
  const sort =
    params.sort && isSortField(params.sort)
      ? params.sort
      : DEFAULT_EMPLOYEE_DIRECTORY_SORT;

  const order =
    params.order === "asc" || params.order === "desc"
      ? params.order
      : DEFAULT_ORDER_BY_FIELD[sort];

  return { sort, order };
}

export function defaultOrderForSortField(
  field: EmployeeDirectorySortField,
): EmployeeDirectorySortOrder {
  return DEFAULT_ORDER_BY_FIELD[field];
}

export function nextEmployeeDirectorySort(
  current: {
    sort: EmployeeDirectorySortField;
    order: EmployeeDirectorySortOrder;
  },
  nextField: EmployeeDirectorySortField,
): {
  sort: EmployeeDirectorySortField;
  order: EmployeeDirectorySortOrder;
} {
  if (current.sort === nextField) {
    return {
      sort: nextField,
      order: current.order === "asc" ? "desc" : "asc",
    };
  }

  return {
    sort: nextField,
    order: DEFAULT_ORDER_BY_FIELD[nextField],
  };
}

export function employeeDirectoryOrderBy(
  sort: EmployeeDirectorySortField,
  order: EmployeeDirectorySortOrder,
): Prisma.EmployeeOrderByWithRelationInput[] {
  const nameTiebreaker: Prisma.EmployeeOrderByWithRelationInput[] = [
    { lastName: "asc" },
    { firstName: "asc" },
  ];

  switch (sort) {
    case "name":
      return [
        { lastName: order },
        { firstName: order },
        { employeeNumber: "asc" },
      ];
    case "number":
      return [{ employeeNumber: order }, ...nameTiebreaker];
    case "department":
      return [{ department: { name: order } }, ...nameTiebreaker];
    case "position":
      return [{ position: { title: order } }, ...nameTiebreaker];
    case "type":
      return [{ employmentType: order }, ...nameTiebreaker];
    case "status":
      return [{ employmentStatus: order }, ...nameTiebreaker];
    case "hireDate":
      return [{ hireDate: order }, ...nameTiebreaker];
  }
}
