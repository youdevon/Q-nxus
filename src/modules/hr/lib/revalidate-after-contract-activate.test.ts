import { describe, expect, it } from "vitest";

import { pathsAfterContractActivate } from "@/src/modules/hr/lib/revalidate-after-contract-activate";

describe("pathsAfterContractActivate", () => {
  it("revalidates payroll salary, readiness, setup, and payslip surfaces", () => {
    const paths = pathsAfterContractActivate("emp-1", "ctr-1");

    expect(paths).toContain("/payroll");
    expect(paths).toContain("/payroll/salaries");
    expect(paths).toContain("/payroll/employees/emp-1");
    expect(paths).toContain("/payroll/employees/emp-1/payslip");
    expect(paths).toContain("/payroll/runs");
    expect(paths).toContain("/people/employees/emp-1");
    expect(paths).toContain("/people/employees/emp-1/contracts/ctr-1");
    expect(paths).toContain("/people/leave/balances");
    expect(paths).toContain("/contracts");
  });
});
