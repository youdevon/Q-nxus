import { describe, expect, it } from "vitest";

import {
  isMidMonthCalendarEnd,
  resolveContinuousEmploymentEnd,
  shouldSkipPayeAutoApplyForPeriod,
} from "@/src/modules/payroll/lib/continuous-employment";

describe("continuous-employment", () => {
  it("detects mid-month calendar ends", () => {
    expect(isMidMonthCalendarEnd(new Date("2026-10-12T00:00:00.000Z"))).toBe(
      true,
    );
    expect(isMidMonthCalendarEnd(new Date("2026-10-31T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("skips PAYE auto-apply only for the mid-month final period", () => {
    const end = new Date("2026-10-12T00:00:00.000Z");
    expect(
      shouldSkipPayeAutoApplyForPeriod({
        periodEnd: new Date("2026-10-31T00:00:00.000Z"),
        employmentEndDate: end,
      }),
    ).toBe(true);
    expect(
      shouldSkipPayeAutoApplyForPeriod({
        periodEnd: new Date("2026-09-30T00:00:00.000Z"),
        employmentEndDate: end,
      }),
    ).toBe(false);
    expect(
      shouldSkipPayeAutoApplyForPeriod({
        periodEnd: new Date("2026-10-31T00:00:00.000Z"),
        employmentEndDate: new Date("2026-10-31T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("merges abutting successor contracts into one continuous end", () => {
    const result = resolveContinuousEmploymentEnd({
      contracts: [
        {
          id: "a",
          startDate: new Date("2026-04-13T00:00:00.000Z"),
          endDate: new Date("2026-10-12T00:00:00.000Z"),
          isCurrent: false,
        },
        {
          id: "b",
          startDate: new Date("2026-10-13T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
          isCurrent: true,
          sourceContractId: "a",
        },
      ],
      asOf: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(result.continuous).toBe(true);
    expect(result.endDate?.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(result.midMonthEnd).toBe(false);
    expect(
      shouldSkipPayeAutoApplyForPeriod({
        periodEnd: new Date("2026-10-31T00:00:00.000Z"),
        employmentEndDate: result.endDate,
      }),
    ).toBe(false);
  });

  it("keeps a gap as a break (mid-month end on first contract)", () => {
    const result = resolveContinuousEmploymentEnd({
      contracts: [
        {
          id: "a",
          startDate: new Date("2026-04-13T00:00:00.000Z"),
          endDate: new Date("2026-10-12T00:00:00.000Z"),
          isCurrent: true,
        },
        {
          id: "b",
          startDate: new Date("2026-10-20T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
          isCurrent: false,
        },
      ],
      asOf: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(result.continuous).toBe(false);
    expect(result.endDate?.toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(result.midMonthEnd).toBe(true);
  });
});
