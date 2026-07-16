import { describe, expect, it } from "vitest";

import { planPeriodAfterDraftPayRunDelete } from "./pay-run-delete";

describe("planPeriodAfterDraftPayRunDelete", () => {
  it("deletes the period when no other runs remain (frees period key)", () => {
    expect(
      planPeriodAfterDraftPayRunDelete({
        periodId: "period-1",
        periodStatus: "OPEN",
        remainingPayRunCount: 0,
      }),
    ).toEqual({ action: "delete_period", periodId: "period-1" });
  });

  it("still deletes an orphan CLOSED period so the key is reusable", () => {
    expect(
      planPeriodAfterDraftPayRunDelete({
        periodId: "period-1",
        periodStatus: "CLOSED",
        remainingPayRunCount: 0,
      }),
    ).toEqual({ action: "delete_period", periodId: "period-1" });
  });

  it("reopens a CLOSED period when only draft runs remain", () => {
    expect(
      planPeriodAfterDraftPayRunDelete({
        periodId: "period-1",
        periodStatus: "CLOSED",
        remainingPayRunCount: 1,
        remainingPostedCount: 0,
      }),
    ).toEqual({ action: "reopen_period", periodId: "period-1" });
  });

  it("keeps CLOSED when a posted run remains (draft correction delete)", () => {
    expect(
      planPeriodAfterDraftPayRunDelete({
        periodId: "period-1",
        periodStatus: "CLOSED",
        remainingPayRunCount: 1,
        remainingPostedCount: 1,
      }),
    ).toEqual({ action: "noop", periodId: "period-1" });
  });

  it("leaves an OPEN period with remaining runs unchanged", () => {
    expect(
      planPeriodAfterDraftPayRunDelete({
        periodId: "period-1",
        periodStatus: "OPEN",
        remainingPayRunCount: 2,
      }),
    ).toEqual({ action: "noop", periodId: "period-1" });
  });
});
