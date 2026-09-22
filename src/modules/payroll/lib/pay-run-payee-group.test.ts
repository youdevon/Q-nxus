import { describe, expect, it } from "vitest";

import {
  effectivePayRunPayeeGroup,
  LEGACY_REGULAR_PAYEE_GROUP,
  parsePayRunPayeeGroup,
  payRunPayeeGroupLabel,
} from "@/src/modules/payroll/lib/pay-run-payee-group";

describe("pay-run-payee-group", () => {
  it("parses known payee groups", () => {
    expect(parsePayRunPayeeGroup("EMPLOYEE")).toBe("EMPLOYEE");
    expect(parsePayRunPayeeGroup("BOARD")).toBe("BOARD");
    expect(parsePayRunPayeeGroup("AGENT")).toBe("AGENT");
    expect(parsePayRunPayeeGroup("CONTRACTOR")).toBe("CONTRACTOR");
  });

  it("rejects unknown values", () => {
    expect(parsePayRunPayeeGroup(null)).toBeNull();
    expect(parsePayRunPayeeGroup("")).toBeNull();
    expect(parsePayRunPayeeGroup("MIXED")).toBeNull();
  });

  it("maps legacy null regular runs to Employees", () => {
    expect(LEGACY_REGULAR_PAYEE_GROUP).toBe("EMPLOYEE");
    expect(effectivePayRunPayeeGroup(null)).toBe("EMPLOYEE");
    expect(effectivePayRunPayeeGroup(undefined)).toBe("EMPLOYEE");
    expect(effectivePayRunPayeeGroup("BOARD")).toBe("BOARD");
  });

  it("labels payee groups for display", () => {
    expect(payRunPayeeGroupLabel("EMPLOYEE")).toBe("Employees");
    expect(payRunPayeeGroupLabel("BOARD")).toBe("Board members");
    expect(payRunPayeeGroupLabel(null)).toBe("Employees");
  });
});
