import { describe, expect, it } from "vitest";

import { isPreviousEmploymentContract } from "@/src/modules/hr/lib/previous-employment-contract";

describe("isPreviousEmploymentContract", () => {
  it("excludes the current contract", () => {
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: true, status: "ACTIVE" },
        [],
      ),
    ).toBe(false);
  });

  it("includes expired and terminated terms", () => {
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "EXPIRED" },
        [],
      ),
    ).toBe(true);
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "TERMINATED" },
        [],
      ),
    ).toBe(true);
  });

  it("includes terms superseded by renewal or extension", () => {
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "SUPERSEDED" },
        [
          {
            id: "c2",
            sourceContractId: "c1",
            changeType: "RENEWAL",
          },
        ],
      ),
    ).toBe(true);

    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "SUPERSEDED" },
        [
          {
            id: "c2",
            sourceContractId: "c1",
            changeType: "EXTENSION",
          },
        ],
      ),
    ).toBe(true);
  });

  it("excludes rows superseded only by amendment-style changes", () => {
    for (const changeType of [
      "AMENDMENT",
      "SALARY_ADJUSTMENT",
      "POSITION_CHANGE",
    ]) {
      expect(
        isPreviousEmploymentContract(
          { id: "c1", isCurrent: false, status: "SUPERSEDED" },
          [
            {
              id: "c2",
              sourceContractId: "c1",
              changeType,
            },
          ],
        ),
      ).toBe(false);
    }
  });

  it("excludes cancelled and draft leftovers", () => {
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "CANCELLED" },
        [],
      ),
    ).toBe(false);
    expect(
      isPreviousEmploymentContract(
        { id: "c1", isCurrent: false, status: "DRAFT" },
        [],
      ),
    ).toBe(false);
  });
});
