import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMPLOYEE_DIRECTORY_ORDER,
  DEFAULT_EMPLOYEE_DIRECTORY_SORT,
  employeeDirectoryOrderBy,
  nextEmployeeDirectorySort,
  parseEmployeeDirectorySort,
} from "./employee-directory-sort";

describe("employee-directory-sort", () => {
  it("defaults to name ascending", () => {
    expect(parseEmployeeDirectorySort({})).toEqual({
      sort: DEFAULT_EMPLOYEE_DIRECTORY_SORT,
      order: DEFAULT_EMPLOYEE_DIRECTORY_ORDER,
    });
  });

  it("uses field default order when order is omitted", () => {
    expect(parseEmployeeDirectorySort({ sort: "hireDate" })).toEqual({
      sort: "hireDate",
      order: "desc",
    });
    expect(parseEmployeeDirectorySort({ sort: "number" })).toEqual({
      sort: "number",
      order: "asc",
    });
  });

  it("ignores invalid sort values", () => {
    expect(
      parseEmployeeDirectorySort({ sort: "nope", order: "desc" }),
    ).toEqual({
      sort: "name",
      order: "desc",
    });
  });

  it("toggles order for the same field and resets for a new field", () => {
    expect(
      nextEmployeeDirectorySort({ sort: "name", order: "asc" }, "name"),
    ).toEqual({ sort: "name", order: "desc" });
    expect(
      nextEmployeeDirectorySort({ sort: "name", order: "asc" }, "hireDate"),
    ).toEqual({ sort: "hireDate", order: "desc" });
  });

  it("builds prisma orderBy for hire date and employee number", () => {
    expect(employeeDirectoryOrderBy("hireDate", "desc")).toEqual([
      { hireDate: "desc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ]);
    expect(employeeDirectoryOrderBy("number", "asc")).toEqual([
      { employeeNumber: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ]);
  });
});
