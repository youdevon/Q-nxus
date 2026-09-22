import { describe, expect, it } from "vitest";

import {
  buildLeaveBalancesUrl,
  buildSelfLeaveForfeitureUrl,
} from "@/src/modules/hr/lib/leave-balances-url";

describe("leave-balances-url", () => {
  it("builds employee balances deep links with forfeiture focus", () => {
    expect(
      buildLeaveBalancesUrl({
        employeeId: "emp_1",
        focus: "forfeiture",
      }),
    ).toBe("/people/leave/balances?employeeId=emp_1&focus=forfeiture");
  });

  it("builds name search URLs", () => {
    expect(buildLeaveBalancesUrl({ query: "Jane Doe" })).toBe(
      "/people/leave/balances?query=Jane+Doe",
    );
  });

  it("builds self-service forfeiture destination", () => {
    expect(buildSelfLeaveForfeitureUrl()).toBe("/me/leave?focus=forfeiture");
  });
});
