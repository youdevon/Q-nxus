import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_EMPLOYEE_DIRECTORY_ORDER,
  DEFAULT_EMPLOYEE_DIRECTORY_SORT,
  employeeDirectoryOrderBy,
  nextEmployeeDirectorySort,
  parseEmployeeDirectorySort,
} from "./employee-directory-sort";

describe("employee-directory-sort", () => {
  it("defaults to name ascending", () => {
    assert.deepEqual(parseEmployeeDirectorySort({}), {
      sort: DEFAULT_EMPLOYEE_DIRECTORY_SORT,
      order: DEFAULT_EMPLOYEE_DIRECTORY_ORDER,
    });
  });

  it("uses field default order when order is omitted", () => {
    assert.deepEqual(parseEmployeeDirectorySort({ sort: "hireDate" }), {
      sort: "hireDate",
      order: "desc",
    });
    assert.deepEqual(parseEmployeeDirectorySort({ sort: "number" }), {
      sort: "number",
      order: "asc",
    });
  });

  it("ignores invalid sort values", () => {
    assert.deepEqual(parseEmployeeDirectorySort({ sort: "nope", order: "desc" }), {
      sort: "name",
      order: "desc",
    });
  });

  it("toggles order for the same field and resets for a new field", () => {
    assert.deepEqual(
      nextEmployeeDirectorySort({ sort: "name", order: "asc" }, "name"),
      { sort: "name", order: "desc" },
    );
    assert.deepEqual(
      nextEmployeeDirectorySort({ sort: "name", order: "asc" }, "hireDate"),
      { sort: "hireDate", order: "desc" },
    );
  });

  it("builds prisma orderBy for hire date and employee number", () => {
    assert.deepEqual(employeeDirectoryOrderBy("hireDate", "desc"), [
      { hireDate: "desc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ]);
    assert.deepEqual(employeeDirectoryOrderBy("number", "asc"), [
      { employeeNumber: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ]);
  });
});
