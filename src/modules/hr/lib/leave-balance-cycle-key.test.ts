import { describe, expect, it } from "vitest";

import { leaveBalanceCycleKey } from "@/src/modules/hr/lib/leave-balance-cycle-key";

describe("leaveBalanceCycleKey", () => {
  it("includes the cycle window in the unique key shape", () => {
    const cycleStart = new Date("2026-01-01T00:00:00.000Z");
    const cycleEnd = new Date("2026-12-31T00:00:00.000Z");
    expect(
      leaveBalanceCycleKey({
        contractId: "c1",
        leaveTypeId: "lt1",
        cycleStart,
        cycleEnd,
      }),
    ).toEqual({
      contractId: "c1",
      leaveTypeId: "lt1",
      cycleStart,
      cycleEnd,
    });
  });
});
