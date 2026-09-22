import { describe, expect, it } from "vitest";

import {
  isEmploymentContractCleanupEligible,
  planBulkExpiredContractCleanup,
  planExpiredContractCleanupCascade,
  type CleanupCascadeContract,
} from "@/src/modules/hr/lib/expired-contract-cleanup";

function contract(
  partial: Partial<CleanupCascadeContract> & Pick<CleanupCascadeContract, "id">,
): CleanupCascadeContract {
  return {
    sourceContractId: null,
    status: "EXPIRED",
    endDate: new Date("2020-01-01T00:00:00.000Z"),
    isCurrent: false,
    contractNumber: partial.id,
    jobTitle: "Role",
    ...partial,
  };
}

describe("isEmploymentContractCleanupEligible", () => {
  it("allows expired, terminated, cancelled, and superseded statuses", () => {
    for (const status of [
      "EXPIRED",
      "TERMINATED",
      "CANCELLED",
      "SUPERSEDED",
    ]) {
      expect(
        isEmploymentContractCleanupEligible({
          status,
          endDate: null,
        }),
      ).toBe(true);
    }
  });

  it("allows active contracts whose end date is in the past", () => {
    expect(
      isEmploymentContractCleanupEligible({
        status: "ACTIVE",
        endDate: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects active contracts that are still in term", () => {
    expect(
      isEmploymentContractCleanupEligible({
        status: "ACTIVE",
        endDate: new Date("2099-01-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("rejects drafts without a past end date", () => {
    expect(
      isEmploymentContractCleanupEligible({
        status: "DRAFT",
        endDate: null,
      }),
    ).toBe(false);
  });
});

describe("planExpiredContractCleanupCascade", () => {
  it("orders tip-first through an expired amendment chain", () => {
    const contracts = [
      contract({ id: "c1", status: "SUPERSEDED" }),
      contract({
        id: "c2",
        sourceContractId: "c1",
        status: "SUPERSEDED",
      }),
      contract({
        id: "c3",
        sourceContractId: "c2",
        status: "EXPIRED",
        isCurrent: true,
      }),
    ];

    const plan = planExpiredContractCleanupCascade("c1", contracts);
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.contracts.map((row) => row.id)).toEqual(["c3", "c2", "c1"]);
  });

  it("deletes expired history and leaves a live successor untouched", () => {
    const contracts = [
      contract({ id: "c1", status: "SUPERSEDED" }),
      contract({
        id: "c2",
        sourceContractId: "c1",
        status: "SUPERSEDED",
      }),
      contract({
        id: "c3",
        sourceContractId: "c2",
        status: "ACTIVE",
        endDate: new Date("2099-01-01T00:00:00.000Z"),
        isCurrent: true,
        contractNumber: "CON-00004",
        jobTitle: "Current role",
      }),
    ];

    const plan = planExpiredContractCleanupCascade("c1", contracts);
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.contracts.map((row) => row.id)).toEqual(["c2", "c1"]);
  });
});

describe("planBulkExpiredContractCleanup", () => {
  it("expands selected roots to include cleanup-eligible descendants tip-first", () => {
    const contracts = [
      contract({ id: "a1", status: "SUPERSEDED" }),
      contract({
        id: "a2",
        sourceContractId: "a1",
        status: "EXPIRED",
      }),
      contract({ id: "b1", status: "EXPIRED" }),
    ];

    const plan = planBulkExpiredContractCleanup(["a1", "b1"], contracts);
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.contracts.map((row) => row.id)).toEqual(["a2", "a1", "b1"]);
  });
});
